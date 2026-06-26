import { supabase } from "../lib/supabase";
import type { LeadProfile } from "../types/ai";

export async function createLead(tenantId: string) {
  const { data, error } = await supabase
    .from("leads")
    .insert({
      tenant_id: tenantId,
      lead_status: "engaged",
      source: "website_chat",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Lead creation error:", error);
    throw new Error("Lead creation failed");
  }

  return data;
}

export async function updateLeadDetails(
  leadId: string,
  profile: LeadProfile,
) {
  const values = {
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    business_name: profile.business_name,
    website: profile.website,
    main_problem: profile.biggest_problem,
    desired_outcome: profile.desired_outcome,
  };
  const cleanValues = Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => typeof value === "string" && value.trim().length > 0,
    ),
  );

  if (!Object.keys(cleanValues).length) return null;

  const { data, error } = await supabase
    .from("leads")
    .update({ ...cleanValues, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("Lead detail update error:", error);
    throw new Error("Failed to update lead details");
  }

  return data;
}