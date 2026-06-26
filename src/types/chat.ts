import type { LeadSignals } from "./ai";

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  stage?: string;
  signals?: LeadSignals;
  showBookingCta?: boolean;
};