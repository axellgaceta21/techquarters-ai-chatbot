import Groq from "groq-sdk";
import { env } from "../config/env.js";

function configurationError(variableName) {
  const error = new Error(`${variableName} is not configured`);
  error.statusCode = 500;
  error.publicMessage = `Server configuration error: ${variableName} is missing.`;
  return error;
}

function getGroqClient() {
  if (!env.GROQ_API_KEY) {
    throw configurationError("GROQ_API_KEY");
  }

  return new Groq({ apiKey: env.GROQ_API_KEY });
}

const stages = new Set([
  "intent",
  "business_context",
  "problem",
  "qualification",
  "capture",
  "booking",
  "nurture",
]);

function clampSignal(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(0, Math.min(10, number))
    : fallback;
}

function fallbackResponse() {
  return {
    reply:
      "Got it. What kind of business is this for, and what problem are you trying to fix right now?",
    stage: "business_context",
    booking_offered: false,
    signals: {
      has_business: false,
      has_traffic_or_spend: false,
      problem_clarity: 3,
      urgency: 3,
      wants_to_book: false,
    },
    profile: {},
    summary: {},
  };
}

function normalizeResponse(raw) {
  const fallback = fallbackResponse();
  let stage = stages.has(raw?.stage) ? raw.stage : fallback.stage;
  const signals = {
    has_business: Boolean(raw?.signals?.has_business),
    has_traffic_or_spend: Boolean(raw?.signals?.has_traffic_or_spend),
    problem_clarity: clampSignal(raw?.signals?.problem_clarity, 3),
    urgency: clampSignal(raw?.signals?.urgency, 3),
    wants_to_book: Boolean(raw?.signals?.wants_to_book),
  };

  const bookingOffered = Boolean(
    raw?.booking_offered || stage === "booking" || signals.wants_to_book,
  );
  if (bookingOffered) stage = "booking";

  return {
    reply:
      typeof raw?.reply === "string" && raw.reply.trim()
        ? raw.reply.trim()
        : fallback.reply,
    stage,
    booking_offered: bookingOffered,
    signals,
    profile:
      raw?.profile && typeof raw.profile === "object" ? raw.profile : {},
    summary:
      raw?.summary && typeof raw.summary === "object" ? raw.summary : {},
    actions: bookingOffered
      ? [
          {
            type: "booking_cta",
            label: "Book a Strategy Call",
            url: env.CALENDLY_URL,
            helperText: "Choose a time that works for you.",
          },
        ]
      : [],
  };
}

export async function generateChatResponse(messages = []) {
  const systemPrompt = `
You are the TechQuarters AI Assistant.

Help website visitors clarify the AI system, automation, software, or integration they need while identifying strong project opportunities.

Goals:
- Understand the visitor's business, problem, urgency, desired outcome, and current tools.
- Remember all facts already provided in the conversation. Never ask for known information again.
- Ask only one useful qualification question at a time.
- Avoid over-questioning a clearly qualified or high-intent lead.
- Move strong-fit leads toward a strategy call.
- Capture useful lead information naturally: name, company/business name, email, optional phone, optional website, business type, main problem, desired outcome, source/traffic context, timing/urgency, and booking preference when appropriate.
- Reassure visitors when asking for details: "Your details are kept private and used only to help our team follow up on your request. They are not displayed publicly." Do not make unsupported legal claims.

Signal rules:
- has_business: true when a real business, brand, agency, store, service, or company is established.
- has_traffic_or_spend: true when leads, traffic, ads, customers, sales, CRM, campaigns, or paid acquisition are established.
- problem_clarity: 0-10 based on how clearly the operational problem is explained.
- urgency: 0-10 based on timing, pain, readiness, or desire to act now.
- wants_to_book: true when the visitor wants to talk, schedule, start, hire, proceed, accepts a proposed call, or otherwise confirms forward movement. Do not depend on an exact phrase.
- booking_offered: true only after enough useful lead context has been collected and you recommend a strategy call, confirm scheduling, acknowledge acceptance of a call, or determine booking intent is high.
- Once a strategy call has been proposed or accepted, keep stage as booking and booking_offered true on the confirming reply.
- If the visitor accepts an offered strategy call (for example: okay, yes, sounds good), confirm the next step and do not resume qualification questions.

Qualification priority:
1. Business type and industry.
2. Main problem.
3. Traffic source or lead volume.
4. Current tools or CRM.
5. Urgency or timeline.
6. Desired outcome.
7. Recommend a strategy call when fit or intent is strong.
- Before recommending a strategy call, collect business name or type, main problem, desired AI solution/outcome, and at least two of: current tools/CRM, traffic or lead source, timeline/urgency.
- If high booking intent appears early, avoid over-qualifying. Ask concisely for name, company, and best email before or immediately after presenting the booking next step.
- For medium-intent leads, capture name, company, email, main problem, and follow-up need before the nurture route.
- For low-intent leads, provide useful guidance first and make contact details optional unless they request follow-up.
- If booking is offered but name, company, email, or main goal are missing, ask for them without blocking booking momentum.

Profile and summary rules:
- Extract only facts supported by the conversation. Use null for unknown profile fields.
- Capture name, email, and phone only when the visitor provides them. Do not invent contact details. Validate email shape before treating it as confirmed.
- Store the requested AI solution and its intended result in desired_outcome.
- Always return the best current summary of the full conversation, not just the newest message.
- ai_summary: concise sales-ready overview covering every captured detail, including business context, problem, desired AI solution, current setup/tools, CRM, traffic/lead source, timeline/urgency, and desired outcome when known.
- pain_points: the concrete operational pain points.
- buying_intent: low, medium, or high.
- recommended_next_action: the most useful next sales action, including a strategy call when appropriate.
- Do not create a substantive summary before enough business context exists.

Voice:
- Helpful, direct, strategic, and premium.
- No markdown and no text outside JSON.

Return only valid JSON in this exact shape:
{
  "reply": "string",
  "stage": "intent | business_context | problem | qualification | capture | booking | nurture",
  "booking_offered": false,
  "signals": {
    "has_business": false,
    "has_traffic_or_spend": false,
    "problem_clarity": 0,
    "urgency": 0,
    "wants_to_book": false
  },
  "profile": {
    "name": null,
    "email": null,
    "phone": null,
    "business_name": null,
    "industry": null,
    "website": null,
    "team_size": null,
    "revenue_range": null,
    "crm": null,
    "traffic_source": null,
    "current_tools": null,
    "biggest_problem": null,
    "urgency_reason": null,
    "budget": null,
    "timeline": null,
    "desired_outcome": null
  },
  "summary": {
    "ai_summary": "",
    "pain_points": "",
    "recommended_next_action": "",
    "buying_intent": "low | medium | high"
  }
}`;

  const formattedMessages = messages
    .filter(
      (message) =>
        message &&
        ["assistant", "user"].includes(message.role) &&
        typeof message.content === "string",
    )
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

  const completion = await getGroqClient().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.25,
    max_tokens: 900,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      ...formattedMessages,
    ],
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response from Groq");

  try {
    return normalizeResponse(JSON.parse(content));
  } catch (error) {
    console.error("AI JSON parse error:", error);
    return fallbackResponse();
  }
}




