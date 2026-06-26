import { createContext } from "react";
import type { ChatMessage } from "../types/chat";

export interface ChatContextValue {
  isOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  isTyping: boolean;
  sendMessage: (text?: string) => Promise<void>;
  trackBookingClick: () => void;
}

export const ChatContext = createContext<ChatContextValue | undefined>(
  undefined,
);