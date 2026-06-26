import { supabase } from "../lib/supabase";

export type LeadProfileUpdate = {
  business_name?: string | null;
  industry?: string | null;
  website?: string | null;
  team_size?: string | null;
  revenue_range?: string | null;
  crm?: string | null;
  traffic_source?: string | null;
  current_tools?: string | null;
  biggest_problem?: string | null;
  urgency_reason?: string | null;
  budget?: string | null;
  timeline?: string | null;
  desired_outcome?: string | null;
};

export async function upsertLeadProfile(
  leadId: string,
  profile: LeadProfileUpdate
) {
  const allowedKeys = [
    "business_name",
    "industry",
    "website",
    "team_size",
    "revenue_range",
    "crm",
    "traffic_source",
    "current_tools",
    "biggest_problem",
    "urgency_reason",
    "budget",
    "timeline",
    "desired_outcome",
  ];

  const cleanProfile: Record<string, string> = {};

  for (const key of allowedKeys) {
    const value = profile[key as keyof LeadProfileUpdate];

    if (typeof value === "string" && value.trim() !== "") {
      cleanProfile[key] = value.trim();
    }
  }

  if (Object.keys(cleanProfile).length === 0) return null;

  const { data, error } = await supabase
    .from("lead_profiles")
    .upsert(
      {
        lead_id: leadId,
        ...cleanProfile,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "lead_id",
      }
    )
    .select()
    .maybeSingle();

  if (error) {
    console.error("Profile upsert error:", error);
    throw error;
  }

  return data;
}