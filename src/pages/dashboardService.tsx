import { DEFAULT_REPORTING_TIMEZONE, safeTimeZone, timezoneRange } from "../lib/timezone";

export type DashboardRange = "today" | "week" | "month";
export type ScoreBucket = "high" | "medium" | "low" | "unscored";

export type DashboardConversation = {
  id: string;
  leadId?: string | null;
  dateTime: string;
  displayName: string;
  email?: string | null;
  score: ScoreBucket;
  leadStatus: string;
  summary: string;
  mainProblem?: string | null;
  bookingStatus: string;
  leadProfile: Record<string, unknown>;
  qualificationSignals: Record<string, unknown>[];
  funnelEvents: Record<string, unknown>[];
  recentMessages: { role: string; content: string; created_at: string }[];
};

export type DashboardData = {
  range: { start: string; end: string; timeZone?: string };
  kpis: {
    totalLeads: number;
    highIntentLeads: number;
    mediumIntentLeads: number;
    lowIntentLeads: number;
    calendlyShown: number;
    calendlyClicked: number;
    bookedCalls: number;
  };
  funnel: {
    stages: { landed: number; engaged: number; qualified: number; booked: number };
    conversions: {
      landedToEngaged: number;
      engagedToQualified: number;
      qualifiedToBooked: number;
      overallBooked: number;
    };
    dropoffs: {
      landedToEngaged: number;
      engagedToQualified: number;
      qualifiedToBooked: number;
    };
    largestLeak: { label: string; dropoff: number; dropoffRate: number };
  };
  calendly: {
    shown: number;
    clicked: number;
    booked: number;
    shownToClicked: number;
    clickedToBooked: number;
    shownToBooked: number;
  };
  todayActivity?: { websiteVisitors: number; chatClicked: number; conversationsOpened: number };
  leadScores: { high: number; medium: number; low: number; unscored: number };
  recentConversations: DashboardConversation[];
};

export function getDashboardRange(range: DashboardRange, timeZone = DEFAULT_REPORTING_TIMEZONE) {
  return timezoneRange(range, timeZone);
}

export function rangeLabel(range: DashboardRange, timeZone = DEFAULT_REPORTING_TIMEZONE) {
  const zone = safeTimeZone(timeZone);
  if (range === "today") return `Today in ${zone}`;
  if (range === "week") return `This Week in ${zone}`;
  return `This Month in ${zone}`;
}

export async function fetchDashboardData(token: string, range: DashboardRange, timeZone = DEFAULT_REPORTING_TIMEZONE) {
  const { start, end, timeZone: zone } = getDashboardRange(range, timeZone);
  const params = new URLSearchParams({ start, end, timeZone: zone });
  const response = await fetch(`/api/admin/dashboard?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body.error || "Failed to load dashboard");
    Object.assign(error, { status: response.status });
    throw error;
  }

  return body as DashboardData;
}
