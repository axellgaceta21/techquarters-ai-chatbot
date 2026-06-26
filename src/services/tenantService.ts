import { supabase } from "../lib/supabase";

export async function getTenantBySlug(slug: string) {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, slug")
    .eq("slug", slug)
    .limit(1);

  if (error || !data || data.length === 0) {
    throw new Error("Tenant not found");
  }

  return data[0];
}