import { sendToN8n } from "../services/n8nService.js";
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
  const { error } = await supabase.from("funnel_events").upsert(
    {
      tenant_id: event.tenant_id,
      lead_id: event.lead_id,
      session_id: event.session_id,
      event_type: event.event_type,
      event_data: { ...event, idempotency_key: idempotencyKey },
      idempotency_key: idempotencyKey,
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );

  if (error) {
    console.error("Funnel event service-role upsert failed:", {
      event_type: event.event_type,
      lead_id: event.lead_id,
      session_id: event.session_id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  return { ...event, idempotency_key: idempotencyKey };
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

    if (!event.event_type || !event.lead_id || !event.session_id) {
      return res.status(400).json({
        error: "event_type, lead_id, and session_id are required",
      });
    }

    if (!event.tenant_id) {
      return res.status(400).json({ error: "tenant_id is required" });
    }

    const payload =
      event.event_type === "booking_completed"
        ? await persistBookingCompleted(event)
        : await persistFunnelEvent(event);

    if (!FORWARDED_EVENTS.has(payload.event_type)) {
      return res.json({ success: true, forwarded: false });
    }

    await sendToN8n(payload);
    return res.json({ success: true, forwarded: true });
  } catch (error) {
    console.error("Event route error:", {
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
