import { supabase } from "../lib/supabase";

export async function getSessionMeta(sessionId: string) {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("summary_notification_sent")
    .eq("id", sessionId)
    .single();

  if (error) throw error;
  return data;
}

export async function markSummaryNotificationSent(sessionId: string) {
  const { error } = await supabase
    .from("chat_sessions")
    .update({
      summary_notification_sent: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}
