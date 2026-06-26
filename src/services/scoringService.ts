import { supabase } from "../lib/supabase";
import type { LeadSignals } from "../types/ai";

export type LeadScore = "low" | "medium" | "high";

export function calculateLeadScore(signals: LeadSignals): LeadScore {
  let score = 0;

  if (signals.has_business) score += 25;
  if (signals.has_traffic_or_spend) score += 15;
  if (signals.wants_to_book) score += 20;

  score += Math.max(0, Math.min(10, signals.problem_clarity)) * 2;
  score += Math.max(0, Math.min(10, signals.urgency)) * 2;

  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

export async function saveScoringSignals(
  leadId: string,
  signals: LeadSignals,
) {
  const score = calculateLeadScore(signals);

  const { error: signalError } = await supabase.from("scoring_signals").insert({
    lead_id: leadId,
    has_business: signals.has_business,
    has_traffic_or_spend: signals.has_traffic_or_spend,
    problem_clarity: signals.problem_clarity,
    urgency: signals.urgency,
    wants_to_book: signals.wants_to_book,
    score_reason: `Calculated score: ${score}`,
    extracted_by: "groq",
  });

  if (signalError) {
    console.error("Scoring signal insert error:", signalError);
    throw new Error("Failed to save scoring signals");
  }

  const { error: leadError } = await supabase
    .from("leads")
    .update({
      lead_score: score,
      lead_status: score === "high" ? "qualified" : "engaged",
    })
    .eq("id", leadId);

  if (leadError) {
    console.error("Lead score update error:", leadError);
    throw new Error("Failed to update lead score");
  }

  return score;
}