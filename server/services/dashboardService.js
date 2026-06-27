import { getSupabaseAdminClient } from "./supabaseAdminClient.js";
import { safeTimeZone, timezoneRange } from "./timezoneService.js";

const SCORE_LABELS = new Set(["high", "medium", "low"]);

function distinctCount(rows, eventType, keyPicker) {
  const values = new Set();
  for (const row of rows) {
    if (row.event_type !== eventType) continue;
    const key = keyPicker(row);
    if (key) values.add(key);
  }
  return values.size;
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function scoreBucket(value) {
  const normalized = String(value || "").toLowerCase();
  return SCORE_LABELS.has(normalized) ? normalized : "unscored";
}

function eventIdentity(row) {
  return (
    row.lead_id ||
    row.session_id ||
    row.event_data?.anonymous_session_id ||
    row.event_data?.visitor_id ||
    row.id
  );
}

function sessionIdentity(row) {
  return row.session_id || row.event_data?.session_id || eventIdentity(row);
}

function leadIdentity(row) {
  return row.lead_id || row.event_data?.lead_id || eventIdentity(row);
}

function calculateLeak(stages) {
  const leaks = [
    { label: "Landed -> Engaged", from: stages.landed, to: stages.engaged },
    { label: "Engaged -> Qualified", from: stages.engaged, to: stages.qualified },
    { label: "Qualified -> Booked", from: stages.qualified, to: stages.booked },
  ].map((leak) => ({
    ...leak,
    dropoff: Math.max(leak.from - leak.to, 0),
    dropoffRate: leak.from ? percent(leak.from - leak.to, leak.from) : 0,
  }));

  return leaks.sort((a, b) => b.dropoffRate - a.dropoffRate)[0];
}

async function queryAll(query, label) {
  const { data, error } = await query;
  if (error) {
    console.error(`${label} query failed:`, error);
    throw new Error(`Failed to load ${label}`);
  }
  return data || [];
}

export async function getDashboardData({ start, end, timeZone }) {
  const supabase = getSupabaseAdminClient();
  const reportingTimeZone = safeTimeZone(timeZone);
  const today = timezoneRange("today", reportingTimeZone);

  const [leads, events, sessions, todayEvents, activityMessages] = await Promise.all([
    queryAll(
      supabase
        .from("leads")
        .select("id, name, email, business_name, main_problem, lead_score, lead_status, calendly_booked, booked_at, created_at, updated_at")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false }),
      "leads",
    ),
    queryAll(
      supabase
        .from("funnel_events")
        .select("id, lead_id, session_id, event_type, event_data, created_at")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false }),
      "funnel events",
    ),
    queryAll(
      supabase
        .from("chat_sessions")
        .select("id, lead_id, session_status, ai_summary, pain_points, recommended_next_action, buying_intent, last_message_at, created_at, updated_at")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false })
        .limit(20),
      "chat sessions",
    ),
    queryAll(
      supabase
        .from("funnel_events")
        .select("id, lead_id, session_id, event_type, event_data, created_at")
        .gte("created_at", today.start)
        .lt("created_at", today.end)
        .order("created_at", { ascending: false }),
      "today funnel events",
    ),
    queryAll(
      supabase
        .from("chat_messages")
        .select("id, session_id, role, created_at")
        .eq("role", "user")
        .gte("created_at", today.start)
        .lt("created_at", today.end)
        .order("created_at", { ascending: true })
        .limit(5000),
      "activity messages",
    ),
  ]);

  const leadIds = [...new Set(sessions.map((session) => session.lead_id).filter(Boolean))];
  const sessionIds = sessions.map((session) => session.id);
  const relatedLeads = leadIds.length
    ? await queryAll(
        supabase
          .from("leads")
          .select("id, name, email, business_name, main_problem, lead_score, lead_status, calendly_booked, booked_at, created_at, updated_at")
          .in("id", leadIds),
        "conversation leads",
      )
    : [];
  const messages = sessionIds.length
    ? await queryAll(
        supabase
          .from("chat_messages")
          .select("id, session_id, role, content, metadata, created_at")
          .in("session_id", sessionIds)
          .order("created_at", { ascending: false })
          .limit(120),
        "chat messages",
      )
    : [];
  const scoringSignals = leadIds.length
    ? await queryAll(
        supabase
          .from("scoring_signals")
          .select("id, lead_id, has_business, has_traffic_or_spend, problem_clarity, urgency, wants_to_book, score_reason, created_at")
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false })
          .limit(80),
        "scoring signals",
      )
    : [];

  const leadById = new Map([...leads, ...relatedLeads].map((lead) => [lead.id, lead]));
  const messagesBySession = new Map();
  for (const message of messages) {
    const list = messagesBySession.get(message.session_id) || [];
    list.push(message);
    messagesBySession.set(message.session_id, list);
  }

  const signalsByLead = new Map();
  for (const signal of scoringSignals) {
    const list = signalsByLead.get(signal.lead_id) || [];
    list.push(signal);
    signalsByLead.set(signal.lead_id, list);
  }

  const highLeads = leads.filter((lead) => scoreBucket(lead.lead_score) === "high").length;
  const mediumLeads = leads.filter((lead) => scoreBucket(lead.lead_score) === "medium").length;
  const lowLeads = leads.filter((lead) => scoreBucket(lead.lead_score) === "low").length;
  const bookedLeadIds = new Set(
    leads
      .filter((lead) => lead.calendly_booked || String(lead.lead_status || "").toLowerCase() === "booked")
      .map((lead) => lead.id),
  );

  // Funnel counts are deduped by the most stable available lead/session/visitor key.
  const landed = distinctCount(events, "landing_viewed", eventIdentity);
  const engaged = Math.max(
    distinctCount(events, "conversation_started", sessionIdentity),
    new Set(messages.filter((message) => message.role === "user").map((message) => message.session_id)).size,
  );
  const qualified = new Set([
    ...events.filter((event) => event.event_type === "lead_qualified").map(leadIdentity),
    ...leads.filter((lead) => scoreBucket(lead.lead_score) === "high").map((lead) => lead.id),
  ].filter(Boolean)).size;
  const calendlyShown = new Set([
    ...events.filter((event) => event.event_type === "calendly_shown" || event.event_type === "booking_offered").map(sessionIdentity),
  ].filter(Boolean)).size;
  const calendlyClicked = distinctCount(events, "booking_clicked", sessionIdentity);
  const todayLanded = distinctCount(todayEvents, "landing_viewed", eventIdentity);
  const chatOpened = distinctCount(todayEvents, "chat_opened", sessionIdentity);
  const conversationsOpened = new Set([
    ...todayEvents.filter((event) => event.event_type === "conversation_started").map(sessionIdentity),
    ...activityMessages.map((message) => message.session_id),
  ].filter(Boolean)).size;
  const booked = new Set([
    ...events.filter((event) => event.event_type === "booking_completed").map(leadIdentity),
    ...bookedLeadIds,
  ].filter(Boolean)).size;
  const stages = { landed, engaged, qualified, booked };

  return {
    range: { start, end, timeZone: reportingTimeZone },
    kpis: {
      totalLeads: leads.length,
      highIntentLeads: highLeads,
      mediumIntentLeads: mediumLeads,
      lowIntentLeads: lowLeads,
      calendlyShown,
      calendlyClicked,
      bookedCalls: booked,
    },
    funnel: {
      stages,
      conversions: {
        landedToEngaged: percent(engaged, landed),
        engagedToQualified: percent(qualified, engaged),
        qualifiedToBooked: percent(booked, qualified),
        overallBooked: percent(booked, landed),
      },
      dropoffs: {
        landedToEngaged: Math.max(landed - engaged, 0),
        engagedToQualified: Math.max(engaged - qualified, 0),
        qualifiedToBooked: Math.max(qualified - booked, 0),
      },
      largestLeak: calculateLeak(stages),
    },
    calendly: {
      shown: calendlyShown,
      clicked: calendlyClicked,
      booked,
      shownToClicked: percent(calendlyClicked, calendlyShown),
      clickedToBooked: percent(booked, calendlyClicked),
      shownToBooked: percent(booked, calendlyShown),
    },
    todayActivity: {
      websiteVisitors: todayLanded,
      chatClicked: chatOpened,
      conversationsOpened,
    },
    leadScores: {
      high: highLeads,
      medium: mediumLeads,
      low: lowLeads,
      unscored: leads.length - highLeads - mediumLeads - lowLeads,
    },
    recentConversations: sessions.map((session) => {
      const lead = leadById.get(session.lead_id) || {};
      const sessionMessages = messagesBySession.get(session.id) || [];
      const sessionEvents = events.filter((event) => event.session_id === session.id || event.lead_id === session.lead_id);
      return {
        id: session.id,
        leadId: session.lead_id,
        dateTime: session.last_message_at || session.created_at,
        displayName: lead.name || lead.business_name || "Anonymous visitor",
        email: lead.email || null,
        score: scoreBucket(lead.lead_score),
        leadStatus: lead.lead_status || session.session_status || "active",
        summary: session.ai_summary || "No session summary yet.",
        mainProblem: lead.main_problem || session.pain_points || null,
        bookingStatus: lead.calendly_booked ? "Booked" : "Not booked",
        leadProfile: lead,
        qualificationSignals: signalsByLead.get(session.lead_id) || [],
        funnelEvents: sessionEvents,
        recentMessages: sessionMessages.reverse().slice(-12),
      };
    }),
  };
}




