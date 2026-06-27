import { API_URLS } from "../config/appConfig";
import type {
  ConversationSummary,
  LeadProfile,
  LeadSignals,
} from "../types/ai";
import type { LeadScore } from "./scoringService";

export type AutomationEventType =
  | "conversation_summary_ready"
  | "booking_offered"
  | "booking_clicked";

export type FunnelEventType =
  | "landing_viewed"
  | "conversation_started"
  | "lead_created"
  | "lead_qualified"
  | "calendly_shown";

export type AutomationEvent = {
  event_type: AutomationEventType;
  tenant_id: string;
  lead_id: string;
  session_id: string;
  booking_url?: string;
  booking_source?: string;
  ai_stage?: string;
  lead_score?: LeadScore;
  signals?: LeadSignals;
  profile?: LeadProfile;
  summary?: ConversationSummary;
};

export type FunnelEvent = {
  event_type: FunnelEventType;
  tenant_id: string;
  lead_id: string;
  session_id: string;
  idempotency_key: string;
  event_data?: Record<string, unknown>;
};

function buildAutomationPayload(event: AutomationEvent) {
  const timestamp = new Date().toISOString();

  return {
    system: "techquarters_chatbot",
    ...event,
    timestamp,
    occurred_at: timestamp,
    booking_source: event.booking_source ||
      (event.event_type === "booking_clicked" ? "chatbot_booking_cta" : undefined),
    ai_summary: event.summary?.ai_summary || null,
    buying_intent: event.summary?.buying_intent || null,
    pain_points: event.summary?.pain_points || null,
    recommendation: event.summary?.recommended_next_action || null,
    metadata: {
      source: "public_chatbot",
      event_version: 2,
      cta_rendered: event.event_type === "booking_offered" || undefined,
      cta_clicked: event.event_type === "booking_clicked" || undefined,
    },
  };
}

function automationIdempotencyKey(event: AutomationEvent) {
  return `${event.event_type}:${event.session_id}`;
}

async function postEvent(payload: Record<string, unknown>, eventType: string) {
  const response = await fetch(API_URLS.events, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.error("Funnel event route error:", errorBody);
    throw new Error(`Failed to save ${eventType}`);
  }

  return response.json() as Promise<{ success: boolean; forwarded: boolean }>;
}

export async function recordFunnelEvent(event: FunnelEvent) {
  return postEvent(
    {
      ...(event.event_data || {}),
      event_type: event.event_type,
      tenant_id: event.tenant_id,
      lead_id: event.lead_id,
      session_id: event.session_id,
      system: "techquarters_chatbot",
      timestamp: new Date().toISOString(),
      occurred_at: new Date().toISOString(),
      idempotency_key: event.idempotency_key,
    },
    event.event_type,
  );
}

export async function recordAndDispatchEvent(event: AutomationEvent) {
  const payload = buildAutomationPayload(event);
  const idempotencyKey = automationIdempotencyKey(event);

  return postEvent(
    { ...payload, idempotency_key: idempotencyKey },
    event.event_type,
  );
}

