import { supabase } from "../lib/supabase";

export async function createChatSession(tenantId: string, leadId: string) {
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      tenant_id: tenantId,
      lead_id: leadId,
      session_status: "active",
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Session creation error:", error);
    throw new Error("Session creation failed");
  }

  return data;
}

export async function updateSessionActivity(sessionId: string) {
  const { error } = await supabase
    .from("chat_sessions")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) {
    console.error("Session activity error:", error);
    throw new Error("Session activity update failed");
  }
}