export type AppConfig = {
  CALENDLY_URL: string;
  TENANT_SLUG: string;
  SUPABASE: { URL: string; ANON_KEY: string };
  API: { BASE_URL: string; CHAT_PATH: string; EVENTS_PATH: string };
  N8N_WEBHOOK_URL: string;
};

export const DEFAULT_CALENDLY_URL: string;
export function createAppConfig(
  environment?: Record<string, string | boolean | undefined>,
): AppConfig;