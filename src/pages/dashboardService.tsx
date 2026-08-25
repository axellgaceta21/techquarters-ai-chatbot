import { DEFAULT_REPORTING_TIMEZONE, safeTimeZone, zonedTimeToUtc, formatDateTime, formatDateOnly, browserTimeZone } from "../lib/timezone";

export type DashboardRange = "today" | "yesterday" | "week" | "lastWeek" | "month" | "lastMonth" | "quarter" | "year" | "allTime" | "custom";
export type DashboardCustomRange = { startDate?: string; endDate?: string };
export type ScoreBucket = "high" | "medium" | "low" | "unscored";

export const PAGE_TITLES = { dashboard: "Command Center", pipeline: "Lead Pipeline", projects: "Projects Hub", settings: "Settings" } as const;
export type PageKey = keyof typeof PAGE_TITLES;

export const PAGE_DESCRIPTIONS: Record<PageKey, string> = {
  dashboard: "Real-time funnel conversion metrics, intent distribution, booking rates, and acquisition channels.",
  pipeline: "Review, filter, inspect, and manage qualified leads, chat transcripts, scoring signals, and booking status.",
  projects: "Track active chatbot deployments, stage progression, milestones, and client handovers.",
  settings: "Configure workspace preferences, assignees, reporting timezones, and data retention rules.",
};

export const DASHBOARD_RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This Week" },
  { value: "lastWeek", label: "Last Week" },
  { value: "month", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
  { value: "allTime", label: "All Time" },
  { value: "custom", label: "Custom Range" },
];

export const SCORE_OPTIONS = ["high", "medium", "low", "unscored"] as const;
export const BOOKING_OPTIONS = ["Not Shown", "Booking Offered", "Booking Clicked", "Confirmed Booked", "Manually Marked Booked"] as const;
export const PROJECT_STAGE_OPTIONS = ["Not Started", "Discovery", "Planning", "Building", "Review", "Live", "On Hold", "Completed"] as const;
export type ProjectStage = typeof PROJECT_STAGE_OPTIONS[number];
export const CONTRACT_STATUS_OPTIONS = ["Pending", "Signed", "Not Required", "Cancelled"] as const;
export type ContractStatus = typeof CONTRACT_STATUS_OPTIONS[number];

export type LeadRow = Record<string, any> & {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  business_name?: string;
  score: ScoreBucket;
  lead_score?: ScoreBucket;
  workflowStatus: string;
  calendlyStatus: string;
  bookingSource: string;
  tags: string[];
  owner_name?: string;
  project_name?: string;
  project_summary?: string;
  project_stage?: ProjectStage;
  contract_status?: ContractStatus;
  project_start_date?: string;
  target_completion_date?: string;
  project_timeline?: string;
  internal_notes?: string;
  booking_notes?: string;
  main_problem?: string;
  desired_outcome?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
  archived_at?: string;
};

export type ConversationRow = Record<string, any> & {
  id: string;
  leadId?: string;
  displayName: string;
  businessName?: string;
  email?: string;
  score: ScoreBucket;
  workflowStatus: string;
  calendlyStatus: string;
  summary?: string;
  mainProblem?: string;
  lastActivity?: string;
  archivedAt?: string | null;
  lead?: Record<string, any>;
};

export type LeadDetailState = Record<string, any> & {
  session: {
    id: string;
    lead_id?: string | null;
    ai_summary?: string;
    last_message_at?: string;
    archived_at?: string | null;
  };
  lead: Record<string, any>;
  score: ScoreBucket;
  workflowStatus: string;
  calendlyStatus: string;
  bookingSource?: string;
  messages: { id?: string; role: string; content: string; created_at?: string; inserted_at?: string }[];
  signals: Record<string, any>[];
  funnelEvents: Record<string, any>[];
  activity: Record<string, any>[];
  isLoadingDetails?: boolean;
  detailError?: string;
};

export type AssigneeUsage = { assignee: string; projectCount: number; affectedCount: number };
export type AssigneeDeleteMode = "reassign" | "unassign" | "unused";

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

export function pct(value: number) {
  return `${value.toFixed(value % 1 ? 1 : 0)}%`;
}

export function dateTime(value?: string | null, timeZone = browserTimeZone()) {
  return formatDateTime(value, timeZone);
}

export function dateOnly(value?: string | null) {
  return formatDateOnly(value);
}

export function scoreClass(score?: string | null) {
  const norm = String(score || "unscored").toLowerCase();
  return `score-badge score-${norm}`;
}

export function stageClass(stage?: string | null) {
  return `stage-${String(stage || "Not Started").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function scoreBucket(value: unknown): ScoreBucket {
  const normalized = String(value || "").toLowerCase();
  return normalized === "high" || normalized === "medium" || normalized === "low" ? normalized : "unscored";
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function bookingTableStatus(status?: string) {
  if (status === "Shown") return "Booking Offered";
  if (status === "Clicked") return "Booking Clicked";
  if (status === "Confirmed Booked") return "Confirmed Booked";
  if (status === "Manually Marked Booked") return "Manual Booked";
  return status || "No Booking Activity";
}

export function bookingDetailStatus(status?: string) {
  if (status === "Shown") return "Booking Offered";
  if (status === "Clicked") return "Booking Clicked";
  return status || "Not Shown";
}

export function isValidEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeTags(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export function tagsFromInput(value: string): string[] {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

export function bookingDraftStatus(detailOrLead: any) {
  return bookingDetailStatus(detailOrLead?.calendlyStatus || detailOrLead?.calendly_status);
}

export function bookingUpdates(status: string) {
  if (status === "Manually Marked Booked" || status === "Confirmed Booked") {
    return { manually_booked: true, booking_source: "Manual Admin Update" };
  }
  if (status === "Booking Offered") {
    return { manually_booked: false, calendly_booked: false, booked_at: null, booking_source: "Manual Admin Booking Offered" };
  }
  if (status === "Booking Clicked") {
    return { manually_booked: false, calendly_booked: false, booked_at: null, booking_source: "Manual Admin Booking Clicked" };
  }
  return { manually_booked: false, calendly_booked: false, booked_at: null, booking_source: null, booking_datetime: null };
}

export function leadDetailShell(row: ConversationRow): LeadDetailState {
  const lead = row.lead || {};
  return {
    session: {
      id: row.id,
      lead_id: row.leadId,
      ai_summary: row.summary,
      last_message_at: row.lastActivity,
      archived_at: row.archivedAt,
    },
    lead,
    score: row.score,
    workflowStatus: row.workflowStatus,
    calendlyStatus: row.calendlyStatus,
    bookingSource: row.bookingSource,
    messages: [],
    signals: [],
    funnelEvents: [],
    activity: [],
    isLoadingDetails: true,
  };
}

export async function adminFetch<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json().catch(() => ({})) : await response.text();
  if (!response.ok) {
    const error = new Error(typeof body === "string" ? body : body.error || "Admin request failed") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body as T;
}

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
