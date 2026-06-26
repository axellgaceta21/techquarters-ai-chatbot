import { createClient } from "@supabase/supabase-js";
import { appConfig } from "../config/appConfig";

if (!appConfig.SUPABASE.URL || !appConfig.SUPABASE.ANON_KEY) {
  throw new Error("Supabase configuration is missing");
}

export const supabase = createClient(
  appConfig.SUPABASE.URL,
  appConfig.SUPABASE.ANON_KEY,
);