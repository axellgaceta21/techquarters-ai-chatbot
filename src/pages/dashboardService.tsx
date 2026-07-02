import { DEFAULT_REPORTING_TIMEZONE, safeTimeZone, zonedTimeToUtc } from "../lib/timezone";

export type DashboardRange = "today" | "yesterday" | "week" | "lastWeek" | "month" | "lastMonth" | "quarter" | "year" | "allTime" | "custom";
export type DashboardCustomRange = { startDate?: string; endDate?: string };
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

function zonedTodayParts(timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12));
  return { year: Number(parts.year), month: Number(parts.month) - 1, date: Number(parts.day), day: date.getUTCDay() };
}

function parseDateInput(value?: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, date: Number(match[3]) };
}

function formatRangeDate(value?: string) {
  const parsed = parseDateInput(value);
  if (!parsed) return "";
  return new Intl.DateTimeFormat("en-AU", { month: "short", day: "numeric", year: "numeric" }).format(new Date(Date.UTC(parsed.year, parsed.month, parsed.date, 12)));
}

function startOfQuarterMonth(month: number) {
  return Math.floor(month / 3) * 3;
}

export function getDashboardRange(range: DashboardRange, timeZone = DEFAULT_REPORTING_TIMEZONE, customRange: DashboardCustomRange = {}) {
  const zone = safeTimeZone(timeZone);
  const today = zonedTodayParts(zone);
  let start = zonedTimeToUtc(today.year, today.month, today.date, zone);
  let end = zonedTimeToUtc(today.year, today.month, today.date + 1, zone);

  if (range === "yesterday") {
    start = zonedTimeToUtc(today.year, today.month, today.date - 1, zone);
    end = zonedTimeToUtc(today.year, today.month, today.date, zone);
  } else if (range === "week") {
    const startDay = today.date - today.day;
    start = zonedTimeToUtc(today.year, today.month, startDay, zone);
    end = zonedTimeToUtc(today.year, today.month, startDay + 7, zone);
  } else if (range === "lastWeek") {
    const startDay = today.date - today.day - 7;
    start = zonedTimeToUtc(today.year, today.month, startDay, zone);
    end = zonedTimeToUtc(today.year, today.month, startDay + 7, zone);
  } else if (range === "month") {
    start = zonedTimeToUtc(today.year, today.month, 1, zone);
    end = zonedTimeToUtc(today.year, today.month + 1, 1, zone);
  } else if (range === "lastMonth") {
    start = zonedTimeToUtc(today.year, today.month - 1, 1, zone);
    end = zonedTimeToUtc(today.year, today.month, 1, zone);
  } else if (range === "quarter") {
    const quarterMonth = startOfQuarterMonth(today.month);
    start = zonedTimeToUtc(today.year, quarterMonth, 1, zone);
    end = zonedTimeToUtc(today.year, quarterMonth + 3, 1, zone);
  } else if (range === "year") {
    start = zonedTimeToUtc(today.year, 0, 1, zone);
    end = zonedTimeToUtc(today.year + 1, 0, 1, zone);
  } else if (range === "allTime") {
    start = zonedTimeToUtc(2020, 0, 1, zone);
    end = zonedTimeToUtc(today.year, today.month, today.date + 1, zone);
  } else if (range === "custom") {
    const customStart = parseDateInput(customRange.startDate) || today;
    const customEnd = parseDateInput(customRange.endDate || customRange.startDate) || customStart;
    const startMs = Date.UTC(customStart.year, customStart.month, customStart.date);
    const endMs = Date.UTC(customEnd.year, customEnd.month, customEnd.date);
    const first = startMs <= endMs ? customStart : customEnd;
    const last = startMs <= endMs ? customEnd : customStart;
    start = zonedTimeToUtc(first.year, first.month, first.date, zone);
    end = zonedTimeToUtc(last.year, last.month, last.date + 1, zone);
  }

  return { start: start.toISOString(), end: end.toISOString(), timeZone: zone };
}

export function rangeLabel(range: DashboardRange, timeZone = DEFAULT_REPORTING_TIMEZONE, customRange: DashboardCustomRange = {}) {
  const zone = safeTimeZone(timeZone);
  if (range === "today") return `Today in ${zone}`;
  if (range === "yesterday") return `Yesterday in ${zone}`;
  if (range === "week") return `This Week in ${zone}`;
  if (range === "lastWeek") return `Last Week in ${zone}`;
  if (range === "month") return `This Month in ${zone}`;
  if (range === "lastMonth") return `Last Month in ${zone}`;
  if (range === "quarter") return `This Quarter in ${zone}`;
  if (range === "year") return `This Year in ${zone}`;
  if (range === "allTime") return `All Time in ${zone}`;
  const start = formatRangeDate(customRange.startDate);
  const end = formatRangeDate(customRange.endDate || customRange.startDate);
  return start && end && start !== end ? `${start} - ${end} in ${zone}` : `${start || "Custom Range"} in ${zone}`;
}

export async function fetchDashboardData(token: string, range: DashboardRange, timeZone = DEFAULT_REPORTING_TIMEZONE, customRange: DashboardCustomRange = {}) {
  const { start, end, timeZone: zone } = getDashboardRange(range, timeZone, customRange);
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
