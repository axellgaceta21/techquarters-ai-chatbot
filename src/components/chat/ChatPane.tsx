import { useEffect, useRef } from "react";
import { CALENDLY_URL } from "../../config/appConfig";
import { useChat } from "../../hooks/useChat";
import Icon from "../ui/Icon";

const quickReplies = [
  "I want to automate a process",
  "I need an AI agent",
  "I need a custom system",
  "I want to integrate my tools",
  "I want to book a call",
  "I have a project idea",
];

export default function ChatPane() {
  const {
    isOpen,
    closeChat,
    messages,
    input,
    setInput,
    isTyping,
    sendMessage,
    trackBookingClick,
  } = useChat();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) window.setTimeout(() => inputRef.current?.focus(), 280);
  }, [isOpen]);

  if (!isOpen) return null;

  const lastBookingActionIndex = messages.reduce((lastIndex, message, index) => {
    if (
      message.role === "assistant" &&
      (message.actions?.some((action) => action.type === "booking_cta") ||
        message.showBookingCta)
    ) {
      return index;
    }

    return lastIndex;
  }, -1);

  return (
    <div
      className="chat-layer"
      role="dialog"
      aria-modal="true"
      aria-label="TechQuarters AI Assistant"
    >
      <button
        className="chat-backdrop"
        onClick={closeChat}
        aria-label="Close chat"
      />
      <section className="chat-pane">
        <header className="chat-header">
          <div className="chat-avatar"><Icon name="spark" /></div>
          <div>
            <strong>TechQuarters AI Assistant</strong>
            <span><i /> Online · Usually replies quickly</span>
          </div>
          <button onClick={closeChat} aria-label="Minimize chat">
            <Icon name="minus" />
          </button>
          <button onClick={closeChat} aria-label="Close chat">
            <Icon name="close" />
          </button>
        </header>
        <div className="chat-messages">
          {messages.map((message, index) => (
            <div
              className={`message-row ${message.role}`}
              key={`${message.role}-${index}`}
            >
              <div className="message-bubble">
                <span>{message.content}</span>
                {message.role === "assistant" &&
                  index === lastBookingActionIndex &&
                  (message.actions?.some((action) => action.type === "booking_cta") ||
                    message.showBookingCta) &&
                  (() => {
                    const action = message.actions?.find(
                      (item) => item.type === "booking_cta",
                    );
                    const href = action?.url || CALENDLY_URL;
                    const label = action?.label || "Book a Strategy Call";

                    return (
                      <div className="booking-cta-card">
                        {action?.helperText && <small>{action.helperText}</small>}
                        <a
                          className="button button-primary booking-cta"
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${label} on Calendly`}
                          onClick={trackBookingClick}
                        >
                          <Icon name="calendar" /> {label}
                        </a>
                      </div>
                    );
                  })()}
              </div>
            </div>
          ))}
          {messages.length === 1 && (
            <div className="quick-replies">
              {quickReplies.map((reply) => (
                <button key={reply} onClick={() => void sendMessage(reply)}>
                  {reply}
                </button>
              ))}
            </div>
          )}
          {isTyping && (
            <div className="message-row assistant">
              <div className="typing"><i /><i /><i /></div>
            </div>
          )}
        </div>
        <form
          className="chat-input"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="What do you want to improve?"
            disabled={isTyping}
          />
          <button
            disabled={!input.trim() || isTyping}
            aria-label="Send message"
          >
            <Icon name="send" />
          </button>
        </form>
        <div className="chat-note">
          <Icon name="spark" /> Powered by TechQuarters AI
        </div>
      </section>
    </div>
  );
}
