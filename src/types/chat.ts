import type { LeadSignals } from "./ai";

export type ChatRole = "user" | "assistant" | "system";

export type ChatAction = {
  type: "booking_cta";
  label: string;
  url: string;
  helperText?: string;
};

export type ChatMessage = {
  role: ChatRole;
  content: string;
  stage?: string;
  signals?: LeadSignals;
  showBookingCta?: boolean;
  actions?: ChatAction[];
};
