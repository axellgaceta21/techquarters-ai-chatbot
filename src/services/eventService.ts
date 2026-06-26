import { API_URLS } from "../config/appConfig";
import { supabase } from "../lib/supabase";
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

export type AutomationEvent = {
  event_type: AutomationEventType;
  tenant_id: string;
  lead_id: string;
  session_id: string;
  booking_url?: string;
  ai_stage?: string;
  lead_score?: LeadScore;
  signals?: LeadSignals;
  profile?: LeadProfile;
  summary?: ConversationSummary;
};

function buildAutomationPayload(event: AutomationEvent) {
  return {
    ...event,
    occurred_at: new Date().toISOString(),
    ai_summary: event.summary?.ai_summary || null,
    buying_intent: event.summary?.buying_intent || null,
    pain_points: event.summary?.pain_points || null,
    recommendation: event.summary?.recommended_next_action || null,
  };
}

export async function recordAndDispatchEvent(event: AutomationEvent) {
  const payload = buildAutomationPayload(event);
  const idempotencyKey =
    event.event_type === "booking_clicked"
      ? `${event.event_type}:${event.session_id}:${crypto.randomUUID()}`
      : `${event.event_type}:${event.session_id}`;
  const { error } = await supabase.from("funnel_events").upsert(
    {
      tenant_id: event.tenant_id,
      lead_id: event.lead_id,
      session_id: event.session_id,
      event_type: event.event_type,
      event_data: payload,
      idempotency_key: idempotencyKey,
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );

  if (error) {
    console.error("Funnel event insert error:", error);
    throw new Error(`Failed to save ${event.event_type}`);
  }

  const response = await fetch(API_URLS.events, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to dispatch ${event.event_type}`);
  }

  return response.json() as Promise<{ success: boolean; forwarded: boolean }>;
}