import { supabase } from "../lib/supabase";
import type { ConversationSummary, LeadProfile } from "../types/ai";

function hasText(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasMeaningfulSummary(summary?: ConversationSummary) {
  if (!summary) return false;

  const overview = summary.ai_summary?.trim() || "";
  const detailCount = [
    summary.pain_points,
    summary.recommended_next_action,
    summary.buying_intent,
  ].filter((value) => typeof value === "string" && value.trim().length > 0).length;

  return overview.length >= 24 && detailCount >= 2;
}

export function hasEnoughLeadDetails(profile: LeadProfile) {
  const hasBusinessContext =
    hasText(profile.business_name) || hasText(profile.industry);
  const hasProblem = hasText(profile.biggest_problem);
  const hasDesiredOutcome = hasText(profile.desired_outcome);
  const supportingDetailCount = [
    hasText(profile.current_tools) || hasText(profile.crm),
    hasText(profile.traffic_source),
    hasText(profile.timeline) || hasText(profile.urgency_reason),
  ].filter(Boolean).length;

  return (
    hasBusinessContext &&
    hasProblem &&
    hasDesiredOutcome &&
    supportingDetailCount >= 2
  );
}

export function isConversationSummaryReady(
  profile: LeadProfile,
  summary?: ConversationSummary,
) {
  return hasEnoughLeadDetails(profile) && hasMeaningfulSummary(summary);
}

export async function updateConversationSummary(
  sessionId: string,
  summary: ConversationSummary,
) {
  const { error } = await supabase
    .from("chat_sessions")
    .update({
      ai_summary: summary.ai_summary?.trim() || null,
      pain_points: summary.pain_points?.trim() || null,
      recommended_next_action:
        summary.recommended_next_action?.trim() || null,
      buying_intent: summary.buying_intent?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    console.error("Summary update error:", error);
    throw new Error("Failed to update conversation summary");
  }
}
