import { createClient } from "@supabase/supabase-js";
import { appConfig } from "../config/appConfig";

if (!appConfig.SUPABASE.URL || !appConfig.SUPABASE.ANON_KEY) {
  throw new Error("Supabase configuration is missing");
}

const createSupabaseClient = () => createClient(
  appConfig.SUPABASE.URL,
  appConfig.SUPABASE.ANON_KEY,
);

type SupabaseBrowserClient = ReturnType<typeof createSupabaseClient>;

declare global {
  var __tqSupabaseClient: SupabaseBrowserClient | undefined;
}

export const supabase: SupabaseBrowserClient = globalThis.__tqSupabaseClient ?? createSupabaseClient();

globalThis.__tqSupabaseClient = supabase;