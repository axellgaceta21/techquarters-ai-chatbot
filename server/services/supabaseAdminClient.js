import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

let client;

export function getSupabaseAdminClient() {
  if (client) return client;

  if (!env.SUPABASE.URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Supabase admin configuration is missing", {
      hasSupabaseUrl: Boolean(env.SUPABASE.URL),
      hasServiceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    });
    const error = new Error("Supabase admin configuration is missing");
    error.statusCode = 500;
    error.publicMessage = "Server configuration error.";
    throw error;
  }

  client = createClient(env.SUPABASE.URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}
