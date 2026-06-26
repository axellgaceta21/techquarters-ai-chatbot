import { API_URLS } from "../config/appConfig";
import type { AIResponse } from "../types/ai";
import type { ChatMessage } from "../types/chat";

export async function askAI(messages: ChatMessage[]): Promise<AIResponse> {
  const response = await fetch(API_URLS.chat, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
  });

  if (!response.ok) {
    throw new Error("AI request failed");
  }

  return response.json() as Promise<AIResponse>;
}