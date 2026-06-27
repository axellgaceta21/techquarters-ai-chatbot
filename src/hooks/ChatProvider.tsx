import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { TENANT_SLUG } from "../config/appConfig";
import { askAI } from "../services/aiService";
import { CALENDLY_URL, shouldOfferBooking } from "../services/bookingService";
import { recordAndDispatchEvent, recordFunnelEvent } from "../services/eventService";
import { createLead, updateLeadDetails } from "../services/leadService";
import {
  getMessagesBySession,
  saveChatMessage,
} from "../services/messageService";
import {
  type LeadProfileUpdate,
  upsertLeadProfile,
} from "../services/profileService";
import {
  calculateLeadScore,
  saveScoringSignals,
  type LeadScore,
} from "../services/scoringService";
import {
  getSessionMeta,
  markSummaryNotificationSent,
} from "../services/sessionMetaService";
import { createChatSession } from "../services/sessionService";
import {
  hasMeaningfulSummary,
  isConversationSummaryReady,
  updateConversationSummary,
} from "../services/summaryService";
import { getTenantBySlug } from "../services/tenantService";
import type {
  ConversationSummary,
  LeadProfile,
  LeadSignals,
} from "../types/ai";
import type { ChatMessage } from "../types/chat";
import { ChatContext } from "./chatContext";

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hi, welcome to TechQuarters AI. Tell us what you want to improve, automate, or build, and we'll point you in the right direction.",
};
const STORAGE_KEY = "tq-chatbot-state-v1";
const VISITOR_KEY = "tq-anonymous-visitor-id";

function getAnonymousVisitorId() {
  const existing = localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;

  const visitorId = crypto.randomUUID();
  localStorage.setItem(VISITOR_KEY, visitorId);
  return visitorId;
}

function visitorTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Australia/Sydney";
}

function visitorDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: visitorTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type ChatIdentity = {
  tenantId: string;
  leadId: string;
  sessionId: string;
};

type AutomationState = {
  profile: LeadProfile;
  summary: ConversationSummary;
  leadScore?: LeadScore;
  signals?: LeadSignals;
  stage?: string;
};

type StoredChatState = {
  identity?: ChatIdentity;
  messages?: ChatMessage[];
  automation?: AutomationState;
  summaryEventSent?: boolean;
  bookingOfferedSent?: boolean;
  landingViewedSent?: boolean;
  conversationStartedSent?: boolean;
  leadQualifiedSent?: boolean;
  calendlyShownSent?: boolean;
  bookingClickedSent?: boolean;
};

function readStoredState(): StoredChatState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as StoredChatState;
  } catch {
    return {};
  }
}

function mergeProfile(
  previous: LeadProfile,
  update?: LeadProfileUpdate,
): LeadProfile {
  if (!update) return previous;

  return Object.fromEntries(
    Object.entries({ ...previous, ...update }).filter(
      ([, value]) => typeof value === "string" && value.trim().length > 0,
    ),
  );
}

function mergeSummary(
  previous: ConversationSummary,
  update?: ConversationSummary,
): ConversationSummary {
  if (!update) return previous;

  return Object.fromEntries(
    Object.entries({ ...previous, ...update }).filter(
      ([, value]) => typeof value === "string" && value.trim().length > 0,
    ),
  );
}

function hasProfileContext(profile: LeadProfile) {
  return Boolean(
    profile.business_name ||
      profile.industry ||
      profile.biggest_problem ||
      profile.desired_outcome,
  );
}

function isNotificationSummaryReady(
  profile: LeadProfile,
  summary: ConversationSummary,
  leadScore: LeadScore,
  response: Awaited<ReturnType<typeof askAI>>,
) {
  return Boolean(
    isConversationSummaryReady(profile, summary) ||
      (hasMeaningfulSummary(summary) &&
        hasProfileContext(profile) &&
        (leadScore === "high" ||
          response.booking_offered ||
          response.stage === "booking" ||
          response.signals.wants_to_book)),
  );
}

function stripCalendlyUrls(text: string) {
  return text
    .replace(/https:\/\/calendly\.com\/[^\s)]+/gi, "the booking button below")
    .replace(/\s+\./g, ".")
    .trim();
}

function bookingActions(offerBooking: boolean, response: Awaited<ReturnType<typeof askAI>>) {
  if (!offerBooking) return [];
  const action = response.actions?.find(
    (item) => item.type === "booking_cta" && typeof item.url === "string",
  );

  return [
    {
      type: "booking_cta" as const,
      label: action?.label || "Book a Strategy Call",
      url: CALENDLY_URL,
      helperText: action?.helperText || "Choose a time that works for you.",
    },
  ];
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [storedState] = useState(readStoredState);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(
    storedState.messages?.length
      ? storedState.messages
      : [WELCOME_MESSAGE],
  );
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const identityRef = useRef<ChatIdentity | undefined>(
    storedState.identity,
  );
  const initializationRef = useRef<Promise<ChatIdentity | undefined> | null>(
    null,
  );
  const automationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const automationRef = useRef<AutomationState>(
    storedState.automation || { profile: {}, summary: {} },
  );
  const summaryEventSentRef = useRef(
    Boolean(storedState.summaryEventSent),
  );
  const bookingOfferedSentRef = useRef(
    Boolean(storedState.bookingOfferedSent),
  );
  const landingViewedSentRef = useRef(Boolean(storedState.landingViewedSent));
  const conversationStartedSentRef = useRef(
    Boolean(storedState.conversationStartedSent),
  );
  const leadQualifiedSentRef = useRef(Boolean(storedState.leadQualifiedSent));
  const calendlyShownSentRef = useRef(Boolean(storedState.calendlyShownSent));
  const bookingClickedSentRef = useRef(Boolean(storedState.bookingClickedSent));

  const persistState = useCallback((nextMessages: ChatMessage[] = messages) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        identity: identityRef.current,
        messages: nextMessages,
        automation: automationRef.current,
        summaryEventSent: summaryEventSentRef.current,
        bookingOfferedSent: bookingOfferedSentRef.current,
        landingViewedSent: landingViewedSentRef.current,
        conversationStartedSent: conversationStartedSentRef.current,
        leadQualifiedSent: leadQualifiedSentRef.current,
        calendlyShownSent: calendlyShownSentRef.current,
        bookingClickedSent: bookingClickedSentRef.current,
      } satisfies StoredChatState),
    );
  }, [messages]);

  const initializeChat = useCallback(async () => {
    if (identityRef.current) return identityRef.current;
    if (initializationRef.current) return initializationRef.current;

    initializationRef.current = (async () => {
      try {
        const tenant = await getTenantBySlug(TENANT_SLUG);
        const lead = await createLead(tenant.id);
        const session = await createChatSession(tenant.id, lead.id);
        const identity = {
          tenantId: tenant.id,
          leadId: lead.id,
          sessionId: session.id,
        };
        identityRef.current = identity;
        persistState();

        try {
          const anonymousSessionId = getAnonymousVisitorId();
          const dateKey = visitorDateKey();
          const timezone = visitorTimeZone();
          await recordFunnelEvent({
            event_type: "lead_created",
            tenant_id: identity.tenantId,
            lead_id: identity.leadId,
            session_id: identity.sessionId,
            idempotency_key: `lead_created:${identity.leadId}`,
            event_data: { anonymous_session_id: anonymousSessionId, visitor_timezone: timezone },
          });

          await recordFunnelEvent({
            event_type: "landing_viewed",
            tenant_id: identity.tenantId,
            lead_id: identity.leadId,
            session_id: identity.sessionId,
            idempotency_key: `landing_viewed:${anonymousSessionId}:${dateKey}`,
            event_data: { anonymous_session_id: anonymousSessionId, date_key: dateKey, visitor_timezone: timezone },
          });
          landingViewedSentRef.current = true;
          persistState();
        } catch (error) {
          console.warn("Initial funnel event tracking failed:", error);
        }

        return identity;
      } catch (error) {
        console.error("Chat persistence initialization failed:", error);
        return undefined;
      } finally {
        initializationRef.current = null;
      }
    })();

    return initializationRef.current;
  }, [persistState]);

  useEffect(() => {
    const storedIdentity = identityRef.current;
    if (!storedIdentity || storedState.messages?.length) {
      if (!storedIdentity) void initializeChat();
      return;
    }

    void getMessagesBySession(storedIdentity.sessionId)
      .then((savedMessages) => {
        if (!savedMessages.length) return;
        const restored = [WELCOME_MESSAGE, ...savedMessages] as ChatMessage[];
        setMessages(restored);
        persistState(restored);
      })
      .catch((error) => console.error("Chat history restore failed:", error));
  }, [initializeChat, persistState, storedState.messages?.length]);

  useEffect(() => {
    persistState(messages);
  }, [messages, persistState]);

  const openChat = useCallback(() => {
    setIsOpen(true);
    void initializeChat();
  }, [initializeChat, persistState]);
  const closeChat = useCallback(() => setIsOpen(false), []);

  const processAutomation = useCallback(
    async (
      identity: ChatIdentity,
      response: Awaited<ReturnType<typeof askAI>>,
      leadScore: LeadScore,
      offerBooking: boolean,
    ) => {
      const profile = mergeProfile(
        automationRef.current.profile,
        response.profile,
      );
      const summary = mergeSummary(
        automationRef.current.summary,
        response.summary,
      );
      const summaryReady = isNotificationSummaryReady(
        profile,
        summary,
        leadScore,
        response,
      );

      automationRef.current = {
        profile,
        summary,
        leadScore,
        signals: response.signals,
        stage: response.stage,
      };
      persistState();

      if (Object.keys(profile).length > 0) {
        await upsertLeadProfile(identity.leadId, profile);
        await updateLeadDetails(identity.leadId, profile);
      }

      if (hasMeaningfulSummary(summary)) {
        await updateConversationSummary(identity.sessionId, summary);
      }

      await saveScoringSignals(identity.leadId, response.signals);

      if (leadScore === "high" && !leadQualifiedSentRef.current) {
        await recordFunnelEvent({
          event_type: "lead_qualified",
          tenant_id: identity.tenantId,
          lead_id: identity.leadId,
          session_id: identity.sessionId,
          idempotency_key: `lead_qualified:${identity.leadId}:v1`,
          event_data: { lead_score: leadScore, signals: response.signals },
        });
        leadQualifiedSentRef.current = true;
        persistState();
      }

      if (offerBooking && !calendlyShownSentRef.current) {
        await recordFunnelEvent({
          event_type: "calendly_shown",
          tenant_id: identity.tenantId,
          lead_id: identity.leadId,
          session_id: identity.sessionId,
          idempotency_key: `calendly_shown:${identity.sessionId}`,
          event_data: { booking_url: CALENDLY_URL, lead_score: leadScore },
        });
        calendlyShownSentRef.current = true;
        persistState();
      }

      if (summaryReady && !summaryEventSentRef.current) {
        let alreadySent = false;
        try {
          const meta = await getSessionMeta(identity.sessionId);
          alreadySent = Boolean(meta.summary_notification_sent);
        } catch (error) {
          console.warn("Summary notification status unavailable:", error);
        }

        if (!alreadySent) {
          await recordAndDispatchEvent({
            event_type: "conversation_summary_ready",
            tenant_id: identity.tenantId,
            lead_id: identity.leadId,
            session_id: identity.sessionId,
            ai_stage: response.stage,
            lead_score: leadScore,
            signals: response.signals,
            profile,
            summary,
          });
          try {
            await markSummaryNotificationSent(identity.sessionId);
          } catch (error) {
            console.warn("Could not mark summary notification sent:", error);
          }
        }

        summaryEventSentRef.current = true;
        persistState();
      }

      if (
        offerBooking &&
        summaryReady &&
        summaryEventSentRef.current &&
        !bookingOfferedSentRef.current
      ) {
        try {
          const meta = await getSessionMeta(identity.sessionId);
          if (!meta.summary_notification_sent) {
            console.warn("Booking offer continuing after summary event dispatch before metadata flag was visible", {
              lead_id: identity.leadId,
              session_id: identity.sessionId,
            });
          }
        } catch (error) {
          console.warn("Booking offer metadata gate unavailable after summary dispatch:", error);
        }

        await recordAndDispatchEvent({
          event_type: "booking_offered",
          tenant_id: identity.tenantId,
          lead_id: identity.leadId,
          session_id: identity.sessionId,
          booking_url: CALENDLY_URL,
          ai_stage: response.stage,
          lead_score: leadScore,
          signals: response.signals,
          profile,
          summary,
        });
        bookingOfferedSentRef.current = true;
        persistState();
      }
    },
    [persistState],
  );

  const sendMessage = useCallback(
    async (text?: string) => {
      const messageText = (text ?? input).trim();
      if (!messageText || isTyping) return;

      const userMessage: ChatMessage = { role: "user", content: messageText };
      const conversation = [...messages, userMessage];
      setInput("");
      setMessages(conversation);
      setIsTyping(true);

      try {
        const identity = await initializeChat();
        if (identity) {
          await saveChatMessage(identity.sessionId, userMessage);
          if (!conversationStartedSentRef.current) {
            await recordFunnelEvent({
              event_type: "conversation_started",
              tenant_id: identity.tenantId,
              lead_id: identity.leadId,
              session_id: identity.sessionId,
              idempotency_key: `conversation_started:${identity.sessionId}`,
              event_data: { visitor_timezone: visitorTimeZone() },
            });
            conversationStartedSentRef.current = true;
            persistState();
          }
        }

        const response = await askAI(conversation);
        const leadScore = calculateLeadScore(response.signals);
        const bookingRequested = shouldOfferBooking(response, leadScore);
        const mergedProfile = mergeProfile(
          automationRef.current.profile,
          response.profile,
        );
        const mergedSummary = mergeSummary(
          automationRef.current.summary,
          response.summary,
        );
        const offerBooking =
          bookingRequested &&
          isNotificationSummaryReady(
            mergedProfile,
            mergedSummary,
            leadScore,
            response,
          );
        const actions = bookingActions(offerBooking, response);
        const reply = response.reply ||
          "Thanks. What outcome would make this project a success?";
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: offerBooking
            ? stripCalendlyUrls(reply) || "You can book a call using the button below."
            : reply,
          stage: response.stage,
          signals: response.signals,
          showBookingCta: actions.length > 0,
          actions,
        };
        const nextMessages = [...conversation, assistantMessage];
        setMessages(nextMessages);

        if (identity) {
          await saveChatMessage(identity.sessionId, assistantMessage);
          automationQueueRef.current = automationQueueRef.current
            .then(() =>
              processAutomation(
                identity,
                response,
                leadScore,
                offerBooking,
              ),
            )
            .catch((error) =>
              console.error("Chat automation pipeline failed:", error),
            );
        }
      } catch (error) {
        console.error("Chat request failed:", error);
        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            content:
              "I'm having trouble connecting right now. Please try again, or email hello@techquarters.ai.",
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [
      initializeChat,
      input,
      isTyping,
      messages,
      processAutomation,
    ],
  );

  const trackBookingClick = useCallback(() => {
    void (async () => {
      if (bookingClickedSentRef.current) return;
      const identity = await initializeChat();
      if (!identity) return;

      await automationQueueRef.current;
      const state = automationRef.current;
      await recordAndDispatchEvent({
        event_type: "booking_clicked",
        tenant_id: identity.tenantId,
        lead_id: identity.leadId,
        session_id: identity.sessionId,
        booking_url: CALENDLY_URL,
        booking_source: "chatbot_booking_cta",
        ai_stage: state.stage,
        lead_score: state.leadScore,
        signals: state.signals,
        profile: state.profile,
        summary: state.summary,
      });
      bookingClickedSentRef.current = true;
      persistState();
    })().catch((error) =>
      console.error("Booking click event failed:", error),
    );
  }, [initializeChat, persistState]);

  const value = useMemo(
    () => ({
      isOpen,
      openChat,
      closeChat,
      messages,
      input,
      setInput,
      isTyping,
      sendMessage,
      trackBookingClick,
    }),
    [
      isOpen,
      openChat,
      closeChat,
      messages,
      input,
      isTyping,
      sendMessage,
      trackBookingClick,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}


