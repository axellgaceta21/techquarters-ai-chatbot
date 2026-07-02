import { enqueueN8nNotification, notificationState, processN8nNotificationRetries } from "../services/n8nService.js";
import { getSupabaseAdminClient } from "../services/supabaseAdminClient.js";

const FORWARDED_EVENTS = new Set([
  "conversation_summary_ready",
  "booking_offered",
  "booking_clicked",
  "booking_completed",
]);

const PERSISTED_EVENTS = new Set([
  "landing_viewed",
  "conversation_started",
  "lead_created",
  "lead_qualified",
  "calendly_shown",
  "conversation_summary_ready",
  "booking_offered",
  "booking_clicked",
  "booking_completed",
]);

function bookingId(event) {
  return (
    event.calendly_event_uri ||
    event.calendly_event_id ||
    event.booking_id ||
    event.event_uri ||
    event.idempotency_key ||
    event.session_id
  );
}

function defaultIdempotencyKey(event) {
  if (event.idempotency_key) return event.idempotency_key;
  if (event.event_type === "booking_completed") return `booking_completed:${bookingId(event)}`;
  if (event.event_type === "lead_qualified") return `lead_qualified:${event.lead_id}:v1`;
  if (event.event_type === "lead_created") return `lead_created:${event.lead_id}`;
  return `${event.event_type}:${event.session_id}`;
}

async function persistFunnelEvent(event) {
  if (!PERSISTED_EVENTS.has(event.event_type)) return event;

  const supabase = getSupabaseAdminClient();
  const idempotencyKey = defaultIdempotencyKey(event);
  const logContext = {
    event_type: event.event_type,
    lead_id: event.lead_id,
    session_id: event.session_id,
    idempotency_key: idempotencyKey,
  };

  const { data: existing, error: lookupError } = await supabase
    .from("funnel_events")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (lookupError) {
    console.error("Funnel event idempotency lookup failed:", {
      ...logContext,
      code: lookupError.code,
      message: lookupError.message,
      details: lookupError.details,
      hint: lookupError.hint,
    });
    throw lookupError;
  }

  if (existing) {
    console.info("Funnel event duplicate skipped:", logContext);
    return { ...event, idempotency_key: idempotencyKey, duplicate: true };
  }

  const { error } = await supabase.from("funnel_events").insert({
    tenant_id: event.tenant_id,
    lead_id: event.lead_id,
    session_id: event.session_id,
    event_type: event.event_type,
    event_data: { ...event, idempotency_key: idempotencyKey, ...(FORWARDED_EVENTS.has(event.event_type) ? { notification: notificationState("pending") } : {}) },
    idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error("Funnel event service-role insert failed:", {
      ...logContext,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  console.info("Funnel event persisted:", logContext);
  return { ...event, idempotency_key: idempotencyKey, duplicate: false };
}

async function persistBookingCompleted(event) {
  const supabase = getSupabaseAdminClient();
  const bookedAt = event.booked_at || event.booking_timestamp || event.occurred_at || new Date().toISOString();

  if (event.lead_id) {
    const { error: leadError } = await supabase
      .from("leads")
      .update({
        calendly_booked: true,
        booked_at: bookedAt,
        lead_status: "booked",
        updated_at: new Date().toISOString(),
      })
      .eq("id", event.lead_id);

    if (leadError) {
      console.error("Booking completion lead update failed:", {
        lead_id: event.lead_id,
        code: leadError.code,
        message: leadError.message,
        details: leadError.details,
        hint: leadError.hint,
      });
      throw leadError;
    }
  }

  const persisted = await persistFunnelEvent({
    ...event,
    event_type: "booking_completed",
    booked_at: bookedAt,
    booking_timestamp: bookedAt,
  });

  return {
    ...persisted,
    booked_at: bookedAt,
    booking_timestamp: bookedAt,
    calendly_event_uri: event.calendly_event_uri || event.event_uri || null,
    suppress_followups: true,
  };
}

export async function handleEventsRequest(req, res) {
  if (req.method && req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const event = req.body || {};
    console.info("Event received:", {
      event_type: event.event_type,
      lead_id: event.lead_id,
      session_id: event.session_id,
      idempotency_key: event.idempotency_key,
    });

    if (!event.event_type || !event.lead_id || !event.session_id) {
      console.warn("Event validation failure:", { reason: "missing required identity", event_type: event.event_type });
      return res.status(400).json({
        error: "event_type, lead_id, and session_id are required",
      });
    }

    if (!event.tenant_id) {
      console.warn("Event validation failure:", { reason: "tenant_id is required", event_type: event.event_type });
      return res.status(400).json({ error: "tenant_id is required" });
    }

    const payload =
      event.event_type === "booking_completed"
        ? await persistBookingCompleted(event)
        : await persistFunnelEvent(event);

    if (!FORWARDED_EVENTS.has(payload.event_type)) {
      return res.json({ success: true, forwarded: false, duplicate: Boolean(payload.duplicate) });
    }

    if (payload.duplicate) {
      console.info("n8n dispatch skipped for duplicate event:", {
        event_type: payload.event_type,
        lead_id: payload.lead_id,
        session_id: payload.session_id,
        idempotency_key: payload.idempotency_key,
      });
      return res.json({ success: true, forwarded: false, duplicate: true });
    }

    console.info("n8n dispatch queued:", {
      event_type: payload.event_type,
      lead_id: payload.lead_id,
      session_id: payload.session_id,
      idempotency_key: payload.idempotency_key,
    });
    enqueueN8nNotification(payload);
    processN8nNotificationRetries().catch((retryError) => {
      console.warn("n8n deferred retry check skipped:", retryError.message);
    });
    return res.json({ success: true, forwarded: true, queued: true, duplicate: false });
  } catch (error) {
    console.error("Event route persistence failure:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return res.status(error.statusCode || 500).json({
      error: error.publicMessage || "Failed to process event",
    });
  }
}


