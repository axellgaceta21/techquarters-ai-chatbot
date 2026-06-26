export const DEFAULT_CALENDLY_URL =
  "https://calendly.com/axellgacetaii/30min";

export function createAppConfig(environment = {}) {
  const apiBaseUrl =
    environment.VITE_API_BASE_URL ||
    environment.API_BASE_URL ||
    (environment.DEV ? "http://localhost:3001" : "");

  return Object.freeze({
    CALENDLY_URL:
      environment.VITE_CALENDLY_URL ||
      environment.CALENDLY_URL ||
      DEFAULT_CALENDLY_URL,
    TENANT_SLUG:
      environment.VITE_TENANT_SLUG ||
      environment.TENANT_SLUG ||
      "techquarters",
    SUPABASE: Object.freeze({
      URL: environment.VITE_SUPABASE_URL || environment.SUPABASE_URL || "",
      ANON_KEY:
        environment.VITE_SUPABASE_ANON_KEY ||
        environment.SUPABASE_ANON_KEY ||
        "",
    }),
    API: Object.freeze({
      BASE_URL: apiBaseUrl.replace(/\/$/, ""),
      CHAT_PATH: "/api/chat",
      EVENTS_PATH: "/api/events",
    }),
    N8N_WEBHOOK_URL: environment.N8N_WEBHOOK_URL || "",
  });
}
