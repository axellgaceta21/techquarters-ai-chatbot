import { supabase } from "../lib/supabase";
import type { ChatMessage } from "../types/chat";
import { updateSessionActivity } from "./sessionService";

export async function saveChatMessage(
  sessionId: string,
  message: ChatMessage,
) {
  const { error } = await supabase.from("chat_messages").insert({
    session_id: sessionId,
    role: message.role,
    content: message.content,
    metadata: {
      stage: message.stage || null,
      signals: message.signals || null,
      show_booking_cta: Boolean(message.showBookingCta),
    },
  });

  if (error) {
    console.error("Message save error:", error);
    throw new Error("Message save failed");
  }

  await updateSessionActivity(sessionId);
}

export async function getMessagesBySession(sessionId: string) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, content, metadata")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Failed to load messages");
  }

  return (data || []).map((message) => ({
    role: message.role,
    content: message.content,
    stage: message.metadata?.stage || undefined,
    signals: message.metadata?.signals || undefined,
    showBookingCta: Boolean(message.metadata?.show_booking_cta),
  })) as ChatMessage[];
}