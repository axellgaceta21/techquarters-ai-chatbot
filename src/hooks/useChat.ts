import { useContext } from "react";
import { ChatContext } from "./chatContext";

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within ChatProvider");
  return context;
}