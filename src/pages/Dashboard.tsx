import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon, { type IconName } from "../components/ui/Icon";
import { supabase } from "../lib/supabase";
import { DEFAULT_REPORTING_TIMEZONE, DISPLAY_TIMEZONE_BROWSER, TIMEZONE_OPTIONS, browserTimeZone, formatDateOnly, formatDateTime, safeTimeZone } from "../lib/timezone";
import { fetchDashboardData, getDashboardRange, rangeLabel, type DashboardCustomRange, type DashboardData, type DashboardRange, type ScoreBucket } from "./dashboardService";

const UNAUTHORIZED_MESSAGE = "This account does not have dashboard access.";
const SESSION_EXPIRED_MESSAGE = "Your session expired. Please sign in again.";

function isInvalidRefreshTokenError(error: unknown) {
  const typedError = error as { message?: string; status?: number; __isAuthError?: boolean };
  const message = (typedError.message || "").toLowerCase();
  return typedError.status === 400 && message.includes("refresh") && message.includes("token")
    || message.includes("invalid refresh token")
    || message.includes("refresh token not found");
}

async function signOutLocally() {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) console.warn("Local admin sign-out cleanup failed.", error);
}
const PAGE_TITLES = { dashboard: "Dashboard", pipeline: "Lead Pipeline", projects: "Projects", settings: "Settings" } as const;
type PageKey = keyof typeof PAGE_TITLES;
const PAGE_DESCRIPTIONS: Record<PageKey, string> = { dashboard: "Monitor live funnel movement, lead quality, booking health, and source performance.", pipeline: "Review, filter, and manage qualified leads, conversations, scores, and booking activity.", projects: "Track active chatbot systems, implementation progress, and connected business workflows.", settings: "Manage dashboard preferences, account controls, integrations, and application settings." };
const DASHBOARD_RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [{ value: "today", label: "Today" }, { value: "yesterday", label: "Yesterday" }, { value: "week", label: "This Week" }, { value: "lastWeek", label: "Last Week" }, { value: "month", label: "This Month" }, { value: "lastMonth", label: "Last Month" }, { value: "quarter", label: "This Quarter" }, { value: "year", label: "This Year" }, { value: "allTime", label: "All Time" }, { value: "custom", label: "Custom Range" }];

type LeadRow = Record<string, any> & { id: string; score: ScoreBucket; workflowStatus: string; calendlyStatus: string; bookingSource: string; tags: string[] };
type ConversationRow = Record<string, any> & { id: string; leadId?: string; score: ScoreBucket; workflowStatus: string; calendlyStatus: string; summary?: string; archivedAt?: string | null };
type LeadDetailState = Record<string, any> & { session: Record<string, any>; lead: Record<string, any>; isLoadingDetails?: boolean; detailError?: string };

function pct(value: number) { return `${value.toFixed(value % 1 ? 1 : 0)}%`; }
function dateTime(value?: string | null, timeZone = browserTimeZone()) { return formatDateTime(value, timeZone); }
function dateOnly(value?: string | null) { return formatDateOnly(value); }
function scoreClass(score: string) { return `score-badge score-${score}`; }
function stageClass(stage?: string | null) { return `stage-${String(stage || "Not Started").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`; }
function scoreBucket(value: unknown): ScoreBucket { const normalized = String(value || "").toLowerCase(); return normalized === "high" || normalized === "medium" || normalized === "low" ? normalized : "unscored"; }
function todayKey() { return new Date().toISOString().slice(0, 10); }
function iconFor(page: PageKey) { return page === "dashboard" ? "growth" : page === "pipeline" ? "agent" : page === "projects" ? "calendar" : "spark"; }
function bookingTableStatus(status?: string) { return status === "Shown" ? "Booking Offered" : status === "Clicked" ? "Booking Clicked" : "No Booking Activity"; }
function bookingDetailStatus(status?: string) { return status === "Shown" ? "Booking Offered" : status === "Clicked" ? "Booking Clicked" : status || "Not Shown"; }
function isValidEmail(value: string) { return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
const SCORE_OPTIONS = ["high", "medium", "low", "unscored"] as const;
const BOOKING_OPTIONS = ["Not Shown", "Booking Offered", "Booking Clicked", "Confirmed Booked", "Manually Marked Booked"] as const;
const PROJECT_STAGE_OPTIONS = ["Not Started", "Discovery", "Planning", "Building", "Review", "Live", "On Hold", "Completed"];
const CONTRACT_STATUS_OPTIONS = ["Pending", "Signed", "Not Required", "Cancelled"];
function normalizeTags(value: unknown) { return Array.isArray(value) ? value.map(String).filter(Boolean) : []; }
function warnMalformedSources(value: unknown) {
  if (import.meta.env.DEV) console.warn("[Dashboard] malformed sources response. Rendering sources as empty only.", value);
}
function parseSourcesString(value: string): unknown {
  try { return JSON.parse(value); }
  catch { warnMalformedSources(value); return []; }
}
function isSourceLike(value: unknown) {
  if (!value || typeof value !== "object") return false;
  return ["source", "leads", "high", "medium", "low", "calendlyShown", "clicked", "confirmedBooked", "qualifiedRate", "bookedRate"].some((key) => key in value);
}
function normalizeSources(value: unknown): Record<string, any>[] {
  if (Array.isArray(value)) return value.filter((item) => {
    const valid = isSourceLike(item);
    if (!valid) warnMalformedSources(item);
    return valid;
  }) as Record<string, any>[];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? normalizeSources(parseSourcesString(trimmed)) : [];
  }
  if (isSourceLike(value)) return [value as Record<string, any>];
  if (value == null) return [];
  warnMalformedSources(value);
  return [];
}
function safeSourceNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
function tagsFromInput(value: string) { return value.split(",").map((tag) => tag.trim()).filter(Boolean); }
function bookingDraftStatus(detailOrLead: any) { return bookingDetailStatus(detailOrLead?.calendlyStatus || detailOrLead?.calendly_status); }

type AssigneeUsage = { assignee: string; projectCount: number; affectedCount: number };
type AssigneeDeleteMode = "reassign" | "unassign" | "unused";
function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return Boolean(element.closest('input, textarea, select, [contenteditable="true"]'));
}
function latestSignal(signals: any[]) { return Array.isArray(signals) && signals.length ? signals[0] : null; }
function yesNo(value: unknown) { return value === true ? "Yes" : value === false ? "No" : "Not captured"; }
function scoreLevel(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not captured";
  if (numeric >= 7) return "High (" + numeric + ")";
  if (numeric >= 4) return "Medium (" + numeric + ")";
  return "Low (" + numeric + ")";
}

function leadDetailShell(row: ConversationRow): LeadDetailState {
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
function bookingUpdates(status: string) {
  if (status === "Manually Marked Booked" || status === "Confirmed Booked") return { manually_booked: true, booking_source: status === "Confirmed Booked" ? "Manual Admin Update" : "Manual Admin Update" };
  if (status === "Booking Offered") return { manually_booked: false, calendly_booked: false, booked_at: null, booking_source: "Manual Admin Booking Offered" };
  if (status === "Booking Clicked") return { manually_booked: false, calendly_booked: false, booked_at: null, booking_source: "Manual Admin Booking Clicked" };
  return { manually_booked: false, calendly_booked: false, booked_at: null, booking_source: null, booking_datetime: null };
}

async function adminFetch<T>(token: string, path: string, options: RequestInit = {}) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json().catch(() => ({})) : await response.text();
  if (!response.ok) {
    const error = new Error(typeof body === "string" ? body : body.error || "Admin request failed") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body as T;
}

type Accent = "blue" | "amber" | "violet" | "green" | "teal" | "gray" | "orange";
type TrendPoint = { label: string; leads: number; conversations: number; qualified: number; booked: number };

function safePct(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(value);
      return;
    }
    const duration = 520;
    const startedAt = window.performance.now();
    let frame = 0;
    setDisplayValue(0);
    function tick(now: number) {
      const progress = Math.min(1, (now - startedAt) / duration);
      setDisplayValue(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    }
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);
  return <>{displayValue}</>;
}

function KpiCard({ label, eyebrow, value, caption, accent, icon, isLoading }: { label: string; eyebrow: string; value: number; caption: string; accent: Accent; icon: IconName; isLoading: boolean }) {
  return <article className={`admin-card kpi-card command-card accent-${accent} fade-in`}><div className="metric-card-top"><span className="metric-icon"><Icon name={icon} /></span><span className="metric-eyebrow">{eyebrow}</span></div><h2>{label}</h2>{isLoading ? <div className="skeleton skeleton-number" /> : <strong><AnimatedNumber value={value} /></strong>}<p>{caption}</p></article>;
}

function PanelHeader({ eyebrow, title, badge }: { eyebrow: string; title: string; badge?: string }) {
  return <div className="panel-heading"><div><span className="metric-eyebrow">{eyebrow}</span><h2>{title}</h2></div>{badge ? <span className="panel-badge">{badge}</span> : null}</div>;
}

function EmptyVisual({ message }: { message: string }) {
  return <p className="empty-state visual-empty">{message}</p>;
}

function LeadActivityTrend({ points, rangeText }: { points: TrendPoint[]; rangeText: string }) {
  const series = [
    { key: "leads", label: "Leads Created", color: "var(--chart-blue)" },
    { key: "conversations", label: "Conversations Opened", color: "var(--chart-teal)" },
    { key: "qualified", label: "Qualified Leads", color: "var(--chart-amber)" },
    { key: "booked", label: "Confirmed Booked", color: "var(--chart-green)" },
  ] as const;
  const hasData = points.some((point) => series.some((item) => point[item.key] > 0));
  const maxValue = Math.max(1, ...points.flatMap((point) => series.map((item) => point[item.key])));
  const width = 640;
  const height = 220;
  const left = 34;
  const right = 18;
  const top = 20;
  const bottom = 34;
  const xFor = (index: number) => left + (points.length <= 1 ? 0 : (index / (points.length - 1)) * (width - left - right));
  const yFor = (value: number) => top + (1 - value / maxValue) * (height - top - bottom);
  return <article className="admin-card chart-panel lead-trend-panel accent-blue">
    <PanelHeader eyebrow="ACTIVITY SIGNALS" title="Lead Activity Trend" badge={rangeText} />
    {hasData ? <><svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Lead activity trend chart">
      {[0, .25, .5, .75, 1].map((tick) => <line key={tick} x1={left} x2={width - right} y1={top + tick * (height - top - bottom)} y2={top + tick * (height - top - bottom)} />)}
      {series.map((item) => {
        const path = points.map((point, index) => `${index ? "L" : "M"} ${xFor(index)} ${yFor(point[item.key])}`).join(" ");
        return <g key={item.key}><path d={path} pathLength={1} style={{ stroke: item.color }} />{points.map((point, index) => <circle key={`${item.key}-${point.label}`} cx={xFor(index)} cy={yFor(point[item.key])} r="3" style={{ fill: item.color }}><title>{`${item.label}: ${point[item.key]} on ${point.label}`}</title></circle>)}</g>;
      })}
      {points.map((point, index) => <text key={point.label} x={xFor(index)} y={height - 10}>{point.label}</text>)}
    </svg><div className="chart-legend">{series.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}</div></> : <EmptyVisual message="No dated dashboard activity exists for this range yet." />}
  </article>;
}

function DistributionBars({ items, total }: { items: { label: string; value: number; accent: Accent }[]; total: number }) {
  return <div className="distribution-bars">{items.map((item) => <div className={`distribution-row accent-${item.accent}`} key={item.label}><div><span>{item.label}</span><b>{item.value}</b><small>{pct(safePct(item.value, total))}</small></div><i><em style={{ width: `${safePct(item.value, total)}%` }} /></i></div>)}</div>;
}

function LeadToBookingJourney({ funnel, shown, clicked, booked, manual, calendly }: { funnel?: DashboardData["funnel"]; shown: number; clicked: number; booked: number; manual: number; calendly?: DashboardData["calendly"] }) {
  const funnelStages = [
    { key: "landed", label: "Landed", value: funnel?.stages.landed || 0, accent: "gray" as const },
    { key: "engaged", label: "Engaged", value: funnel?.stages.engaged || 0, accent: "blue" as const },
    { key: "qualified", label: "Qualified", value: funnel?.stages.qualified || 0, accent: "amber" as const },
    { key: "booked", label: "Booked", value: funnel?.stages.booked || 0, accent: "green" as const },
  ];
  const bookingStages = [
    { label: "Offered", value: shown, accent: "blue" as const },
    { label: "Clicked", value: clicked, accent: "amber" as const },
    { label: "Confirmed", value: booked, accent: "green" as const },
    { label: "Manual", value: manual, accent: "violet" as const },
  ];
  const maxFunnel = Math.max(1, ...funnelStages.map((stage) => stage.value));
  const maxBooking = Math.max(1, ...bookingStages.map((stage) => stage.value));
  return <article className="admin-card chart-panel lead-booking-journey accent-green">
    <PanelHeader eyebrow="FUNNEL & BOOKING PERFORMANCE" title="Lead-to-Booking Journey" badge={`Overall booked: ${pct(funnel?.conversions.overallBooked || 0)}`} />
    <div className="journey-flow-wrap">
      <div className="journey-group"><span className="journey-group-label">Lead Funnel</span><div className="journey-flow-row" aria-label="Lead funnel stage flow">{funnelStages.map((stage, index) => <div className={`journey-step accent-${stage.accent}`} key={stage.key}><span>{stage.label}</span><strong>{stage.value}</strong><i><em style={{ width: `${safePct(stage.value, maxFunnel)}%` }} /></i>{index < funnelStages.length - 1 ? <b className="journey-arrow">&gt;</b> : null}</div>)}</div></div>
      <div className="journey-group"><span className="journey-group-label">Booking Actions</span><div className="journey-flow-row booking-action-row" aria-label="Booking action flow">{bookingStages.map((stage, index) => <div className={`journey-step accent-${stage.accent}`} key={stage.label}><span>{stage.label}</span><strong>{stage.value}</strong><i><em style={{ width: `${safePct(stage.value, maxBooking)}%` }} /></i>{index < bookingStages.length - 1 ? <b className="journey-arrow">&gt;</b> : null}</div>)}</div></div>
    </div>
    <div className="journey-notes"><span>Offered &gt; Clicked: {pct(calendly?.shownToClicked || 0)}</span><span>Clicked &gt; Booked: {pct(calendly?.clickedToBooked || 0)}</span><span>Offered &gt; Booked: {pct(calendly?.shownToBooked || 0)}</span>{funnel?.largestLeak ? <span>Largest drop-off: {funnel.largestLeak.label} at {pct(funnel.largestLeak.dropoffRate)}</span> : null}</div>
  </article>;
}
function TodayActivityVisual({ activity, needingActionToday }: { activity?: DashboardData["todayActivity"]; needingActionToday: number }) {
  const values = [
    { label: "Website Visitors", value: activity?.websiteVisitors || 0, accent: "blue" as const, icon: "eye" as IconName },
    { label: "Clicked Chat", value: activity?.chatClicked || 0, accent: "violet" as const, icon: "chat" as IconName },
    { label: "Opened Conversation", value: activity?.conversationsOpened || 0, accent: "teal" as const, icon: "agent" as IconName },
    { label: "Need Action", value: needingActionToday, accent: "orange" as const, icon: "spark" as IconName },
  ];
  return <article className="admin-card chart-panel activity-card compact-activity-card accent-amber"><PanelHeader eyebrow="ACTIVITY SIGNALS" title="Today's Activity" badge="Today" /><div className="activity-grid compact-signal-grid">{values.map((item) => <div className={`activity-tile compact-signal accent-${item.accent}`} key={item.label}><Icon name={item.icon} /><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></article>;
}

type SourceMixItem = { label: string; value: number; accent: Accent; color: string };

function LeadSourceMix({ items, total }: { items: SourceMixItem[]; total: number }) {
  let offset = 0;
  return <article className="admin-card chart-panel source-mix-panel accent-blue"><PanelHeader eyebrow="LEAD DISTRIBUTION" title="Lead Source Mix" badge="Live Data" />{total ? <div className="donut-layout"><svg className="donut-chart" viewBox="0 0 42 42" role="img" aria-label="Lead source mix donut chart"><circle className="donut-track" cx="21" cy="21" r="15.915" />{items.map((item) => {
    const share = safePct(item.value, total);
    const segment = <circle key={item.label} className="donut-segment" cx="21" cy="21" r="15.915" strokeDasharray={`${share} ${100 - share}`} strokeDashoffset={-offset} style={{ stroke: item.color }}><title>{`${item.label}: ${item.value} (${pct(share)})`}</title></circle>;
    offset += share;
    return segment;
  })}<text x="21" y="20">{total}</text><text x="21" y="25">leads</text></svg><div className="source-legend">{items.map((item) => <div className={`source-legend-row accent-${item.accent}`} key={item.label}><span><i style={{ background: item.color }} />{item.label}</span><b>{item.value}</b><small>{pct(safePct(item.value, total))}</small></div>)}</div></div> : <EmptyVisual message="No source or UTM data exists for this range yet." />}</article>;
}

function ScoreDonut({ items, total }: { items: { label: string; value: number; accent: Accent; color: string }[]; total: number }) {
  let offset = 0;
  return <article className="admin-card chart-panel score-breakdown score-donut-panel accent-amber"><PanelHeader eyebrow="CONVERSION PERFORMANCE" title="Lead Score Breakdown" badge="Live Data" />{total ? <div className="donut-layout score-donut-layout"><svg className="donut-chart" viewBox="0 0 42 42" role="img" aria-label="Lead score breakdown donut chart"><circle className="donut-track" cx="21" cy="21" r="15.915" />{items.map((item) => {
    const share = safePct(item.value, total);
    const segment = <circle key={item.label} className="donut-segment" cx="21" cy="21" r="15.915" strokeDasharray={`${share} ${100 - share}`} strokeDashoffset={-offset} style={{ stroke: item.color }}><title>{`${item.label}: ${item.value} (${pct(share)})`}</title></circle>;
    offset += share;
    return segment;
  })}<text x="21" y="20">{total}</text><text x="21" y="25">leads</text></svg><div className="source-legend score-legend">{items.map((item) => <div className={`source-legend-row accent-${item.accent}`} key={item.label}><span><i style={{ background: item.color }} />{item.label}</span><b>{item.value}</b><small>{pct(safePct(item.value, total))}</small></div>)}</div></div> : <EmptyVisual message="No lead scores in this range." />}</article>;
}
function BookingConversionColumns({ shown, clicked, booked, manual }: { shown: number; clicked: number; booked: number; manual: number }) {
  const columns = [
    { label: "Offered", value: shown, accent: "blue" as const },
    { label: "Clicked", value: clicked, accent: "amber" as const },
    { label: "Confirmed", value: booked, accent: "green" as const },
    { label: "Manual", value: manual, accent: "violet" as const },
  ];
  const maxValue = Math.max(1, ...columns.map((item) => item.value));
  return <article className="admin-card chart-panel booking-columns-panel accent-violet"><PanelHeader eyebrow="BOOKING HEALTH" title="Booking Conversion by Period" badge="Live Data" /><div className="column-chart">{columns.map((item) => <div className={`column-item accent-${item.accent}`} key={item.label}><div className="column-track"><i style={{ height: `${safePct(item.value, maxValue)}%` }}><title>{`${item.label}: ${item.value}`}</title></i></div><strong>{item.value}</strong><span>{item.label}</span></div>)}</div></article>;
}
function ProjectOverview({ ongoing, completed, onViewProjects }: { ongoing: LeadRow[]; completed: LeadRow[]; onViewProjects: () => void }) {
  const total = ongoing.length + completed.length;
  const ongoingPct = safePct(ongoing.length, Math.max(1, total));
  const completedPct = safePct(completed.length, Math.max(1, total));
  return <article className="admin-card chart-panel project-overview-panel compact-project-panel accent-green"><PanelHeader eyebrow="PROJECT DELIVERY" title="Project Overview" badge="Real Data" />{total ? <div className="compact-project-body"><div className="project-overview-metrics compact-project-metrics"><div className="project-overview-metric accent-blue"><span>Ongoing</span><strong>{ongoing.length}</strong></div><div className="project-overview-metric accent-green"><span>Completed</span><strong>{completed.length}</strong></div></div><div className="project-status-bar compact-project-bar" aria-label={`${pct(completedPct)} completed projects`}><span style={{ width: `${ongoingPct}%` }} /><i style={{ width: `${completedPct}%` }} /></div></div> : <EmptyVisual message="No project data yet. Move a qualified lead to Projects to populate this panel." />}<button className="button button-secondary compact-action project-overview-link" type="button" onClick={onViewProjects}>View Projects</button></article>;
}
function EditableCell({ value, onSave, type = "text", options }: { value?: string | null; type?: string; options?: string[]; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value || "");
  useEffect(() => setDraft(value || ""), [value]);
  if (options) return <select className={options.includes("Completed") ? `stage-select ${stageClass(draft)}` : ""} value={draft} onChange={(event) => { setDraft(event.target.value); onSave(event.target.value); }}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  return <input type={type} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => onSave(draft)} />;
}


function QualificationSummary({ signals, score, lead }: { signals: any[]; score: string; lead: Record<string, any> }) {
  const signal = latestSignal(signals) || {};
  const hasSignal = Boolean(latestSignal(signals));
  return <article className="modal-messages qualification-summary"><h3>Qualification Summary</h3>{hasSignal ? null : <p>No qualification signals stored yet.</p>}<div className="qualification-grid"><span>Outcome</span><b>{signal.qualification_outcome || signal.outcome || lead.qualification_outcome || "Not captured"}</b><span>Intent</span><b>{signal.intent || signal.intent_level || score}</b><span>Problem</span><b>{signal.problem || lead.main_problem || "Not captured"}</b><span>Desired outcome</span><b>{signal.desired_outcome || lead.desired_outcome || "Not captured"}</b><span>Has business</span><b>{yesNo(signal.has_business)}</b><span>Has traffic or spend</span><b>{yesNo(signal.has_traffic_or_spend)}</b><span>Problem clarity</span><b>{scoreLevel(signal.problem_clarity)}</b><span>Urgency</span><b>{scoreLevel(signal.urgency)}</b><span>Wants to book</span><b>{yesNo(signal.wants_to_book)}</b><span>Final score</span><b><span className={`qualification-final-score ${scoreClass(score)}`}>{score}</span></b></div>{signal.summary ? <p className="qualification-reason"><b>Summary:</b> {signal.summary}</p> : null}{signal.score_reason ? <p className="qualification-reason"><b>Score reason:</b> {signal.score_reason}</p> : null}</article>;
}

function DetailLoading({ label }: { label: string }) {
  return <div className="detail-section-loading"><div className="skeleton detail-skeleton-line" /><p>{label}</p></div>;
}

function DetailError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="detail-section-error"><p>{message}</p><button className="button button-secondary compact-action" type="button" onClick={onRetry}>Retry</button></div>;
}

function CombinedConversationTimeline({ detail, displayTimezone, onRetry }: { detail: LeadDetailState; displayTimezone: string; onRetry: () => void }) {
  const detailError = detail.detailError || "";
  const detailsLoading = Boolean(detail.isLoadingDetails);
  const messageItems = (detail.messages || []).map((message: any) => ({ id: `message-${message.id || message.created_at}`, type: "message", label: message.role === "assistant" ? "AI reply" : message.role === "user" ? "Visitor message" : String(message.role || "Message"), text: message.content || "", date: message.created_at || message.inserted_at }));
  const eventItems = [...(detail.activity || []), ...(detail.funnelEvents || [])].map((event: any) => ({ id: `event-${event.id || event.created_at}-${event.event_type}`, type: "event", label: String(event.event_type || event.type || "Activity"), text: event.event_data?.label || event.event_data?.status || event.description || "System event", date: event.created_at || event.inserted_at }));
  const timeline = [...messageItems, ...eventItems].filter((item) => item.date || item.text).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  return <article className="modal-messages combined-timeline"><h3>Conversation & Activity Timeline</h3>{detailError ? <DetailError message="Conversation and activity details could not be loaded." onRetry={onRetry} /> : detailsLoading ? <DetailLoading label="Loading conversation and activity timeline..." /> : timeline.length ? <div className="timeline-list">{timeline.map((item) => <div className={`timeline-item timeline-${item.type}`} key={item.id}><div><b>{item.label}</b><time>{dateTime(item.date, displayTimezone)}</time></div>{item.text ? <p>{item.text}</p> : null}</div>)}</div> : <p>No conversation or activity events found.</p>}</article>;
}
function LeadDetailModal({ detail, displayTimezone, onClose, onUpdate, onMoveToProjects, onArchive, onDelete, onRetry }: { detail: LeadDetailState; displayTimezone: string; onClose: () => void; onUpdate: (id: string, updates: Record<string, unknown>) => Promise<void>; onMoveToProjects: (id: string, updates: Record<string, unknown>) => Promise<void>; onArchive: () => void; onDelete: () => void; onRetry: () => void }) {
  const lead = detail.lead || {};
  const isAlreadyProject = Boolean(lead.completed_at) || detail.workflowStatus === "Completed";
  const detailsLoading = Boolean(detail.isLoadingDetails);
  const detailError = detail.detailError || "";
  const [draft, setDraft] = useState({
    name: lead.name || "",
    email: lead.email || "",
    business_name: lead.business_name || "",
    phone: lead.phone || "",
    lead_score: detail.score || "unscored",
    booking_status: bookingDraftStatus(detail),
    tags: normalizeTags(lead.tags).join(", "),
    internal_notes: lead.internal_notes || "",
    booking_notes: lead.booking_notes || "",
    project_name: lead.project_name || "",
    project_summary: lead.project_summary || "",
    project_stage: lead.project_stage || "Not Started",
    contract_status: lead.contract_status || "Pending",
    project_start_date: lead.project_start_date || "",
    target_completion_date: lead.target_completion_date || "",
    project_timeline: lead.project_timeline || "",
  });
  const [fieldError, setFieldError] = useState("");
  const [saving, setSaving] = useState(false);
  function buildUpdates(extra: Record<string, unknown> = {}) {
    return {
      name: draft.name,
      email: draft.email,
      business_name: draft.business_name,
      phone: draft.phone,
      lead_score: draft.lead_score === "unscored" ? null : draft.lead_score,
      tags: tagsFromInput(draft.tags),
      internal_notes: draft.internal_notes,
      booking_notes: draft.booking_notes,
      project_name: draft.project_name,
      project_summary: draft.project_summary,
      project_stage: draft.project_stage,
      contract_status: draft.contract_status,
      project_start_date: draft.project_start_date,
      target_completion_date: draft.target_completion_date,
      project_timeline: draft.project_timeline,
      ...bookingUpdates(draft.booking_status),
      ...extra,
    };
  }
  async function saveDetail() {
    if (!isValidEmail(draft.email)) { setFieldError("Enter a valid email address."); return; }
    setFieldError("");
    setSaving(true);
    try { await onUpdate(lead.id, buildUpdates()); }
    finally { setSaving(false); }
  }
  async function moveToProjects() {
    if (isAlreadyProject || saving) return;
    if (!isValidEmail(draft.email)) { setFieldError("Enter a valid email address."); return; }
    const ok = window.confirm("Move this lead to Projects? The lead will be removed from the active Lead Pipeline and available in the Projects tab. Existing conversation, score, booking, notes, and lead data will be preserved.");
    if (!ok) return;
    setFieldError("");
    setSaving(true);
    try {
      await onMoveToProjects(lead.id, buildUpdates({ workflow_status: "Completed", completed_at: new Date().toISOString(), project_stage: draft.project_stage || "Not Started" }));
    } finally { setSaving(false); }
  }

  return <div className="admin-modal-layer" role="dialog" aria-modal="true">
    <button className="admin-modal-backdrop" type="button" onClick={onClose} aria-label="Close details" />
    <section className="admin-modal admin-card workspace-modal">
      <div className="admin-modal-header">
        <div><span className={scoreClass(draft.lead_score)}>{draft.lead_score}</span><h2>{draft.name || draft.business_name || "Anonymous visitor"}</h2><p>{draft.email || "No email stored"}</p>{isAlreadyProject ? <p className="modal-status-note">This lead is already in Projects.</p> : null}</div>
        <div className="modal-header-actions"><button className="button button-primary" type="button" disabled={saving} onClick={() => void saveDetail()}>{saving ? "Saving..." : "Save"}</button><button className="button button-secondary" type="button" onClick={onClose}>Close</button></div>
      </div>
      <div className="admin-modal-body lead-detail-body">
        {fieldError ? <p className="field-error modal-field-error">{fieldError}</p> : null}
        <section className="lead-identity-strip">
          <div><span>Name</span><b>{draft.name || "Anonymous visitor"}</b></div>
          <div><span>Email</span><b>{draft.email || "No email stored"}</b></div>
          <div><span>Business</span><b>{draft.business_name || "Not captured"}</b></div>
          <div><span>Status</span><b>{detail.workflowStatus || "Active"}</b></div>
          <div><span>Booking</span><b>{bookingDetailStatus(draft.booking_status)}</b></div>
        </section>
        {detailError ? <article className="modal-messages qualification-summary"><h3>Qualification Summary</h3><DetailError message="Qualification details could not be loaded." onRetry={onRetry} /></article> : detailsLoading ? <article className="modal-messages qualification-summary"><h3>Qualification Summary</h3><DetailLoading label="Loading qualification details..." /></article> : <QualificationSummary signals={detail.signals || []} score={draft.lead_score} lead={lead} />}
        <div className="modal-grid detail-grid">
          <article><h3>Lead Details</h3><p>Website: {lead.website || "Not captured"}</p><p>Main problem: {lead.main_problem || "Not captured"}</p><p>Desired outcome: {lead.desired_outcome || "Not captured"}</p><p>Owner: {lead.owner_name || "Unassigned"}</p><p>Follow-up due: {dateOnly(lead.follow_up_due_date)}</p></article>
          <article className="detail-form-card"><h3>Contact & Status</h3><label><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label><span>Email</span><input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label><label><span>Business</span><input value={draft.business_name} onChange={(event) => setDraft({ ...draft, business_name: event.target.value })} /></label><label><span>Phone</span><input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label><label><span>Score</span><select value={draft.lead_score} onChange={(event) => setDraft({ ...draft, lead_score: event.target.value as ScoreBucket })}>{SCORE_OPTIONS.map((item) => <option key={item} value={item}>{item === "unscored" ? "Unscored" : item[0].toUpperCase() + item.slice(1)}</option>)}</select></label><label><span>Booking</span><select value={draft.booking_status} onChange={(event) => setDraft({ ...draft, booking_status: event.target.value })}>{BOOKING_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Tags</span><input value={draft.tags} placeholder="proposal, urgent" onChange={(event) => setDraft({ ...draft, tags: event.target.value })} /></label></article>
          <article><h3>Booking Information</h3><p>Status: {bookingDetailStatus(detail.calendlyStatus)}</p><p>Booking source: {detail.bookingSource || "Not captured"}</p><p>Booking time: {dateTime(lead.booking_datetime || lead.booked_at, displayTimezone)}</p><p>Manual edits are saved as lead updates and do not create Calendly events.</p></article>
          <article className="detail-form-card"><h3>Score Signals</h3>{detailsLoading ? <DetailLoading label="Loading score signals..." /> : detail.signals?.length ? <p>{latestSignal(detail.signals)?.score_reason || "Signals captured for this lead."}</p> : <p>No score signals stored yet.</p>}</article>
        </div>
        <article className="modal-messages notes-card"><h3>Notes</h3><div className="notes-grid"><label><span>Admin Notes</span><textarea value={draft.internal_notes} onChange={(event) => setDraft({ ...draft, internal_notes: event.target.value })} /></label><label><span>Booking Notes</span><textarea value={draft.booking_notes} onChange={(event) => setDraft({ ...draft, booking_notes: event.target.value })} /></label></div></article>
        <article className="modal-messages"><h3>Project Tracking</h3><div className="project-grid"><input placeholder="Project name" value={draft.project_name} onChange={(event) => setDraft({ ...draft, project_name: event.target.value })} /><select className={`stage-select ${stageClass(draft.project_stage)}`} value={draft.project_stage} onChange={(event) => setDraft({ ...draft, project_stage: event.target.value })}>{PROJECT_STAGE_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select><select value={draft.contract_status} onChange={(event) => setDraft({ ...draft, contract_status: event.target.value })}>{CONTRACT_STATUS_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select><label><span>From</span><input type="date" value={draft.project_start_date} onChange={(event) => setDraft({ ...draft, project_start_date: event.target.value })} /></label><label><span>To</span><input type="date" value={draft.target_completion_date} onChange={(event) => setDraft({ ...draft, target_completion_date: event.target.value })} /></label><textarea placeholder="Timeline / milestones" value={draft.project_timeline} onChange={(event) => setDraft({ ...draft, project_timeline: event.target.value })} /><textarea placeholder="Project summary" value={draft.project_summary} onChange={(event) => setDraft({ ...draft, project_summary: event.target.value })} /></div></article>
        <CombinedConversationTimeline detail={detail} displayTimezone={displayTimezone} onRetry={onRetry} />
      </div>
      <div className="admin-modal-footer"><button className="button button-secondary" type="button" disabled={isAlreadyProject || saving} onClick={() => void moveToProjects()}>{isAlreadyProject ? "Already in Projects" : "Move to Projects"}</button><span className="modal-footer-spacer" /><button className="button button-secondary compact-action" type="button" onClick={onArchive}>Archive</button><button className="button button-secondary compact-action danger" type="button" onClick={onDelete}>Delete</button></div>
    </section>
  </div>;
}
export default function Dashboard() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [activePage, setActivePage] = useState<PageKey>(() => {
    const storedPage = localStorage.getItem("tq-admin-active-page") as PageKey | null;
    return storedPage && storedPage in PAGE_TITLES ? storedPage : "dashboard";
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("tq-admin-theme") || "dark");
  const [detectedTimezone] = useState(browserTimeZone);
  const [displayTimezonePreference, setDisplayTimezonePreference] = useState(() => localStorage.getItem("tq-admin-display-timezone") || DISPLAY_TIMEZONE_BROWSER);
  const [reportingTimezone, setReportingTimezone] = useState(() => safeTimeZone(localStorage.getItem("tq-admin-reporting-timezone"), DEFAULT_REPORTING_TIMEZONE));
  const [range, setRange] = useState<DashboardRange>("today");
  const [customStartDate, setCustomStartDate] = useState(todayKey());
  const [customEndDate, setCustomEndDate] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [dashboardProjects, setDashboardProjects] = useState<LeadRow[]>([]);
  const [leadFilter, setLeadFilter] = useState("active");
  const [leadSearch] = useState("");
  const [tagSearch] = useState("");
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [conversationMeta, setConversationMeta] = useState({ totalSessionCount: 0, filteredCount: 0 });
  const [scoreFilter, setScoreFilter] = useState(localStorage.getItem("tq-admin-default-filter") || "scored");
  const [conversationSize, setConversationSize] = useState(localStorage.getItem("tq-admin-default-page-size") || "20");
  const [conversationArchiveView, setConversationArchiveView] = useState("active");
  const [selectMode, setSelectMode] = useState(false);
  const [assignees, setAssignees] = useState<string[]>(() => JSON.parse(localStorage.getItem("tq-admin-assignees") || "[\"Axell\",\"Kaan\"]"));
  const [newAssignee, setNewAssignee] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detail, setDetail] = useState<LeadDetailState | null>(null);
  const [projectDetail, setProjectDetail] = useState<LeadRow | null>(null);
  const [projectView, setProjectView] = useState<"ongoing" | "completed">("ongoing");
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [archivedRows, setArchivedRows] = useState<ConversationRow[]>([]);
  const [archivedSelected, setArchivedSelected] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshingPage, setRefreshingPage] = useState<PageKey | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const feedbackTimer = useRef<number | null>(null);
  const detailCacheRef = useRef<Map<string, LeadDetailState>>(new Map());
  const detailRequestsRef = useRef<Map<string, number>>(new Map());
  const detailRequestSeq = useRef(0);
  const selectedDetailSessionIdRef = useRef<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [leadSummary, setLeadSummary] = useState({ filteredCount: 0, totalLeadCount: 0, needingActionToday: 0 });

  useEffect(() => {
    const hasModalOpen = Boolean(detail || projectDetail || archivedOpen);
    document.body.style.overflow = hasModalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [detail, projectDetail, archivedOpen]);

  useEffect(() => { document.documentElement.dataset.adminTheme = theme; localStorage.setItem("tq-admin-theme", theme); }, [theme]);
  useEffect(() => { localStorage.setItem("tq-admin-assignees", JSON.stringify(assignees)); }, [assignees]);
  useEffect(() => { localStorage.setItem("tq-admin-display-timezone", displayTimezonePreference); }, [displayTimezonePreference]);
  useEffect(() => { localStorage.setItem("tq-admin-reporting-timezone", reportingTimezone); }, [reportingTimezone]);
  useEffect(() => { localStorage.setItem("tq-admin-active-page", activePage); }, [activePage]);
  useEffect(() => {
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    if (!feedback || feedback === "Saving...") return;
    feedbackTimer.current = window.setTimeout(() => {
      setFeedback("");
      feedbackTimer.current = null;
    }, 3000);
    return () => {
      if (feedbackTimer.current) {
        window.clearTimeout(feedbackTimer.current);
        feedbackTimer.current = null;
      }
    };
  }, [feedback]);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || isEditableTarget(event.target)) return;
      if (archivedOpen && archivedSelected.length) {
        event.preventDefault();
        event.stopPropagation();
        setArchivedSelected([]);
        setFeedback("Selection cleared.");
        return;
      }
      if (selectMode && selectedIds.length) {
        event.preventDefault();
        event.stopPropagation();
        setSelectedIds([]);
        setFeedback("Selection cleared.");
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [archivedOpen, archivedSelected.length, selectMode, selectedIds.length]);

  const handleExpiredAdminSession = useCallback(async () => {
    setToken("");
    setData(null);
    setSources([]);
    setLeads([]);
    setConversations([]);
    setError("");
    sessionStorage.removeItem("tq-admin-logout");
    await signOutLocally();
    navigate("/admin/login", { replace: true, state: { message: SESSION_EXPIRED_MESSAGE } });
  }, [navigate]);

  const handleAuthError = useCallback(async (loadError: unknown) => {
    const status = (loadError as Error & { status?: number }).status;
    if (status === 401 || isInvalidRefreshTokenError(loadError)) await handleExpiredAdminSession();
    else if (status === 403) { await signOutLocally(); navigate("/admin/login", { replace: true, state: { message: UNAUTHORIZED_MESSAGE } }); }
    else setError((loadError as Error).message || "Admin data could not be loaded.");
  }, [handleExpiredAdminSession, navigate]);
  const displayTimezone = displayTimezonePreference === DISPLAY_TIMEZONE_BROWSER ? detectedTimezone : safeTimeZone(displayTimezonePreference, detectedTimezone);

  useEffect(() => { document.title = `TechQuarters AI - ${PAGE_TITLES[activePage]}`; }, [activePage]);

  const loadDashboard = useCallback(async (nextToken = token, showLoading = true) => {
    if (!nextToken) return;
    if (showLoading) setIsLoading(true);
    setError("");
    try {
      const customRange: DashboardCustomRange = { startDate: customStartDate, endDate: customEndDate };
      const dashboardData = await fetchDashboardData(nextToken, range, reportingTimezone, customRange);
      setData(dashboardData);
      setLastUpdated(new Date().toISOString());

      const { start, end, timeZone } = getDashboardRange(range, reportingTimezone, customRange);
      try {
        const sourceData = await adminFetch<unknown>(nextToken, `/api/admin/sources?${new URLSearchParams({ start, end, timeZone })}`);
        setSources(normalizeSources(sourceData));
      } catch (sourceError) {
        if (import.meta.env.DEV) console.error("[Dashboard] sources load error:", sourceError);
        setSources([]);
      }

      try {
        const projectData = await adminFetch<any>(nextToken, `/api/admin/leads?${new URLSearchParams({ filter: "completed", timeZone })}`);
        setDashboardProjects(projectData.rows || []);
      } catch (projectError) {
        if (import.meta.env.DEV) console.error("[Dashboard] project overview load error:", projectError);
        setDashboardProjects([]);
      }
    } catch (loadError) {
      if (import.meta.env.DEV) console.error("[Dashboard] load error:", loadError);
      await handleAuthError(loadError);
    } finally { setIsLoading(false); }
  }, [customEndDate, customStartDate, handleAuthError, range, reportingTimezone, token]);

  const loadLeads = useCallback(async (nextToken = token) => {
    if (!nextToken) return;
    try {
      const params = new URLSearchParams({ filter: leadFilter, search: leadSearch, tag: tagSearch, timeZone: reportingTimezone });
      const result = await adminFetch<any>(nextToken, `/api/admin/leads?${params}`);
      setLeads(result.rows || []); setLeadSummary({ filteredCount: result.filteredCount || 0, totalLeadCount: result.totalLeadCount || 0, needingActionToday: result.needingActionToday || 0 });
    } catch (loadError) { await handleAuthError(loadError); }
  }, [handleAuthError, leadFilter, leadSearch, reportingTimezone, tagSearch, token]);

  const loadConversations = useCallback(async (nextToken = token) => {
    if (!nextToken) return;
    try {
      const params = new URLSearchParams({ score: scoreFilter, pageSize: conversationSize, archived: conversationArchiveView });
      const result = await adminFetch<any>(nextToken, `/api/admin/conversations?${params}`);
      setConversations(result.rows || []); setConversationMeta({ totalSessionCount: result.totalSessionCount || 0, filteredCount: result.filteredCount || 0 }); setSelectedIds([]);
    } catch (loadError) { await handleAuthError(loadError); }
  }, [conversationArchiveView, conversationSize, handleAuthError, scoreFilter, token]);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      setIsLoading(true);
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (sessionError) {
          if (isInvalidRefreshTokenError(sessionError)) await handleExpiredAdminSession();
          else navigate("/admin/login", { replace: true, state: { message: SESSION_EXPIRED_MESSAGE } });
          return;
        }
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) { navigate("/admin/login", { replace: true }); return; }
        try {
          const settings = await adminFetch<any>(accessToken, "/api/admin/settings");
          if (settings.reporting_timezone && isMounted) setReportingTimezone(safeTimeZone(settings.reporting_timezone));
        } catch (settingsError) {
          if (!isMounted) return;
          if ((settingsError as Error & { status?: number }).status === 401) await handleExpiredAdminSession();
          else console.warn("Admin settings unavailable, using local timezone preferences.", settingsError);
        }
        if (isMounted) setToken(accessToken);
      } catch (sessionError) {
        if (!isMounted) return;
        if (isInvalidRefreshTokenError(sessionError)) await handleExpiredAdminSession();
        else navigate("/admin/login", { replace: true, state: { message: SESSION_EXPIRED_MESSAGE } });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [handleExpiredAdminSession, navigate]);
  useEffect(() => { if (token) void loadDashboard(token, false); }, [loadDashboard, range, reportingTimezone, token]);
  useEffect(() => { if (token) void loadLeads(token); }, [leadFilter, leadSearch, loadLeads, reportingTimezone, tagSearch, token]);
  useEffect(() => { if (token) void loadConversations(token); }, [scoreFilter, conversationSize, conversationArchiveView, loadConversations, token]);
  useEffect(() => { if (token && activePage === "projects") { setLeadFilter("completed"); } }, [activePage, token]);

  async function logout() { await supabase.auth.signOut(); sessionStorage.setItem("tq-admin-logout", "1"); navigate("/admin/login?logged_out=1", { replace: true, state: { loggedOut: true } }); }
  async function loadDetailInBackground(sessionId: string, requestId: number) {
    if (!token || detailRequestsRef.current.has(sessionId)) return;
    detailRequestsRef.current.set(sessionId, requestId);
    try {
      const loaded = await adminFetch<LeadDetailState>(token, `/api/admin/conversation-detail?id=${encodeURIComponent(sessionId)}`);
      const nextDetail = { ...loaded, isLoadingDetails: false, detailError: "" };
      detailCacheRef.current.set(sessionId, nextDetail);
      if (selectedDetailSessionIdRef.current === sessionId && detailRequestSeq.current === requestId) setDetail(nextDetail);
    } catch (loadError) {
      if ((loadError as Error & { status?: number }).status === 401 || isInvalidRefreshTokenError(loadError)) {
        await handleAuthError(loadError);
        return;
      }
      if (import.meta.env.DEV) console.error("[Dashboard] lead detail load error:", loadError);
      if (selectedDetailSessionIdRef.current === sessionId && detailRequestSeq.current === requestId) {
        setDetail((current) => {
          if (!current || current.session.id !== sessionId) return current;
          return { ...current, isLoadingDetails: false, detailError: "Lead details could not be loaded." };
        });
      }
    } finally {
      if (detailRequestsRef.current.get(sessionId) === requestId) detailRequestsRef.current.delete(sessionId);
    }
  }

  function openDetail(row: ConversationRow) {
    if (!token) return;
    selectedDetailSessionIdRef.current = row.id;
    const cached = detailCacheRef.current.get(row.id);
    const existingRequestId = detailRequestsRef.current.get(row.id);
    const requestId = existingRequestId || ++detailRequestSeq.current;
    detailRequestSeq.current = requestId;
    setDetail(cached || leadDetailShell(row));
    if (!cached && !existingRequestId) void loadDetailInBackground(row.id, requestId);
  }

  function retryDetailLoad() {
    const sessionId = detail?.session?.id;
    if (!sessionId || !token) return;
    const requestId = ++detailRequestSeq.current;
    selectedDetailSessionIdRef.current = sessionId;
    detailCacheRef.current.delete(sessionId);
    setDetail((current) => {
      if (!current || current.session.id !== sessionId) return current;
      return { ...current, isLoadingDetails: true, detailError: "" };
    });
    void loadDetailInBackground(sessionId, requestId);
  }

  function updateCachedLead(id: string, saved: LeadRow) {
    for (const [sessionId, cached] of detailCacheRef.current) {
      if (cached.lead?.id === id) {
        detailCacheRef.current.set(sessionId, { ...cached, lead: { ...cached.lead, ...saved }, score: scoreBucket(saved.lead_score), calendlyStatus: saved.calendlyStatus || cached.calendlyStatus, bookingSource: saved.bookingSource || cached.bookingSource });
      }
    }
  }

  function invalidateDetailCache(sessionIds: string[]) {
    for (const sessionId of sessionIds) detailCacheRef.current.delete(sessionId);
  }

  async function updateLead(id: string, updates: Record<string, unknown>) {
    if (!token) return;
    setFeedback("Saving...");
    try {
      const saved = await adminFetch<LeadRow>(token, `/api/admin/leads?id=${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(updates) });
      updateCachedLead(id, saved);
      setFeedback("Saved.");
      await loadLeads();
      if (detail?.lead?.id === id) setDetail({ ...detail, lead: { ...detail.lead, ...saved }, score: scoreBucket(saved.lead_score), calendlyStatus: saved.calendlyStatus || detail.calendlyStatus, bookingSource: saved.bookingSource || detail.bookingSource });
      if (projectDetail?.id === id) setProjectDetail({ ...projectDetail, ...saved, score: scoreBucket(saved.lead_score) });
    } catch (saveError) {
      setFeedback((saveError as Error).message);
      throw saveError;
    }
  }
  async function moveLeadToProjects(id: string, updates: Record<string, unknown>) {
    await updateLead(id, updates);
    await Promise.all([loadConversations(), loadLeads()]);
    setDetail(null);
    setActivePage("projects");
    setProjectView("ongoing");
    setFeedback("Saved.");
  }
  async function openArchivedData() { if (!token) return; const result = await adminFetch<any>(token, `/api/admin/conversations?${new URLSearchParams({ score: "all", pageSize: "all", archived: "archived" })}`); setArchivedRows(result.rows || []); setArchivedSelected([]); setArchivedOpen(true); }
  async function archiveSelected(archived: boolean, ids = selectedIds) { if (!token || !ids.length) return; await adminFetch(token, "/api/admin/conversations", { method: "PATCH", body: JSON.stringify({ ids, archived }) }); invalidateDetailCache(ids); await loadConversations(); if (archivedOpen) await openArchivedData(); setFeedback(archived ? "Saved." : "Saved."); }
  async function deleteSelected(ids = selectedIds, confirmProtected = false) {
    if (!token || !ids.length) return;
    const ok = window.confirm("Deletion is permanent and may remove associated messages, funnel events, and operational conversation data. Continue?");
    if (!ok) return;
    try { await adminFetch(token, "/api/admin/conversations", { method: "DELETE", body: JSON.stringify({ ids, confirmProtected }) }); invalidateDetailCache(ids); await loadConversations(); setDetail(null); selectedDetailSessionIdRef.current = null; setProjectDetail(null); setFeedback("Lead deleted."); }
    catch (deleteError) {
      if ((deleteError as Error & { status?: number }).status === 409 && window.confirm("This includes booked, contacted, in-progress, or completed leads. Type-level extra confirmation is required. Continue with stronger confirmation?")) await deleteSelected(ids, true);
      else setFeedback((deleteError as Error).message);
    }
  }
  async function loadAssigneeUsage(name: string) {
    if (!token) throw new Error("Admin session required");
    return await adminFetch<AssigneeUsage>(token, "/api/admin/assignees?" + new URLSearchParams({ name }));
  }
  async function deleteAssignee(name: string, mode: AssigneeDeleteMode, replacementName?: string) {
    if (!token) throw new Error("Admin session required");
    const result = await adminFetch<AssigneeUsage & { deleted: string }>(token, "/api/admin/assignees", { method: "PATCH", body: JSON.stringify({ name, mode, replacementName }) });
    setAssignees((items) => items.filter((item) => item !== name));
    await loadLeads();
    setFeedback("Saved.");
    return result;
  }

  async function exportCsv() {
    if (!token) return;
    const params = new URLSearchParams({ filter: leadFilter, search: leadSearch, tag: tagSearch, format: "csv" });
    const response = await fetch(`/api/admin/leads?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) { setFeedback("CSV export failed."); return; }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `techquarters-leads-${todayKey()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }


  async function refreshActivePage() {
    if (!token || refreshingPage) return;
    setRefreshingPage(activePage);
    try {
      if (activePage === "dashboard") await loadDashboard(token, false);
      else if (activePage === "pipeline") await loadConversations(token);
      else if (activePage === "projects") await loadLeads(token);
      else if (archivedOpen) await openArchivedData();
      else setLastUpdated(new Date().toISOString());
    } finally { setRefreshingPage(null); }
  }
  const kpis = data?.kpis; const funnel = data?.funnel; const calendly = data?.calendly; const scores = data?.leadScores;
  const normalizedSources = useMemo(() => normalizeSources(sources), [sources]);
  const selectedCustomRange = useMemo<DashboardCustomRange>(() => ({ startDate: customStartDate, endDate: customEndDate }), [customEndDate, customStartDate]);
  const sourceMixItems = useMemo<SourceMixItem[]>(() => {
    const colors = ["var(--chart-blue)", "var(--chart-teal)", "var(--chart-amber)", "var(--chart-green)", "var(--chart-violet)", "var(--chart-gray)"];
    const accents: Accent[] = ["blue", "teal", "amber", "green", "violet", "gray"];
    return normalizedSources.map((source, index) => ({ label: String(source?.source || "Unknown"), value: safeSourceNumber(source?.leads), color: colors[index % colors.length], accent: accents[index % accents.length] })).filter((item) => item.value > 0);
  }, [normalizedSources]);
  const sourceMixTotal = useMemo(() => sourceMixItems.reduce((sum, item) => sum + item.value, 0), [sourceMixItems]);
  const scoreTotal = useMemo(() => scores ? scores.high + scores.medium + scores.low + scores.unscored : 0, [scores]);
  const manualBookedCount = useMemo(() => conversations.filter((row) => row.calendlyStatus === "Manually Marked Booked").length, [conversations]);
  const activityTrend = useMemo(() => {
    const buckets = new Map<string, TrendPoint>();
    for (const row of data?.recentConversations || []) {
      const key = formatDateOnly(row.dateTime) || "Unknown";
      const bucket = buckets.get(key) || { label: key, leads: 0, conversations: 0, qualified: 0, booked: 0 };
      bucket.leads += row.leadId ? 1 : 0;
      bucket.conversations += 1;
      if (row.score === "high" || row.score === "medium") bucket.qualified += 1;
      if (row.bookingStatus === "Confirmed Booked" || row.bookingStatus === "Manually Marked Booked") bucket.booked += 1;
      buckets.set(key, bucket);
    }
    return [...buckets.values()].sort((a, b) => a.label.localeCompare(b.label)).slice(-10);
  }, [data?.recentConversations]);
  const intentItems = [
    { label: "High Intent", value: kpis?.highIntentLeads || 0, accent: "green" as const },
    { label: "Medium Intent", value: kpis?.mediumIntentLeads || 0, accent: "amber" as const },
    { label: "Low Intent", value: kpis?.lowIntentLeads || 0, accent: "gray" as const },
  ];
  const scoreItems = scores ? ([
    { label: "High", value: scores.high, accent: "green" as const, color: "var(--chart-green)" },
    { label: "Medium", value: scores.medium, accent: "amber" as const, color: "var(--chart-amber)" },
    { label: "Low", value: scores.low, accent: "gray" as const, color: "var(--chart-gray)" },
    { label: "Unscored", value: scores.unscored, accent: "violet" as const, color: "var(--chart-violet)" },
  ]) : [];
  const dashboardOngoingProjects = dashboardProjects.filter((lead) => String(lead.project_stage || "Not Started") !== "Completed");
  const dashboardCompletedProjects = dashboardProjects.filter((lead) => String(lead.project_stage || "Not Started") === "Completed");
  const completedLeads = leads.filter((lead) => lead.completed_at || lead.workflowStatus === "Completed");
  const visibleLeads = leadFilter === "completed" ? completedLeads : leads;
  const ongoingProjects = visibleLeads.filter((lead) => String(lead.project_stage || "Not Started") !== "Completed");
  const completedProjects = visibleLeads.filter((lead) => String(lead.project_stage || "Not Started") === "Completed");

  return <section className="admin-workspace">
    <button className={`admin-drawer-overlay ${drawerOpen ? "open" : ""}`} type="button" onClick={() => setDrawerOpen(false)} aria-label="Close navigation" />
    <aside className={`admin-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${drawerOpen ? "drawer-open" : ""}`}>
      <div className="sidebar-brand"><img src="/logo.png" alt="TechQuarters logo" /><button type="button" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}><Icon name={sidebarCollapsed ? "plus" : "minus"} /></button></div><button className="theme-icon-button" type="button" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><Icon name={theme === "dark" ? "sun" : "moon"} /><span>{theme === "dark" ? "Light mode" : "Dark mode"}</span></button>
      <nav>{(["dashboard", "pipeline", "projects", "settings"] as PageKey[]).map((page) => <button key={page} className={`${activePage === page ? "active" : ""} nav-${page}`} type="button" title={PAGE_TITLES[page]} onClick={() => { setActivePage(page); setDrawerOpen(false); }}><Icon name={iconFor(page)} /><span>{PAGE_TITLES[page]}</span></button>)}</nav>
    </aside>
    <div className="admin-main-shell">
      <header className={`admin-topbar page-accent-${activePage}`}><button className="mobile-nav-button" type="button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button><div className="page-title-wrap"><div className="page-title-row"><h1>{PAGE_TITLES[activePage]}</h1><button className="icon-action title-refresh" type="button" title={`Refresh ${PAGE_TITLES[activePage]}`} aria-label={`Refresh ${PAGE_TITLES[activePage]}`} disabled={refreshingPage === activePage} onClick={() => void refreshActivePage()}><Icon className={refreshingPage === activePage ? "spin" : ""} name="refresh" /></button></div><p>{PAGE_DESCRIPTIONS[activePage]}</p></div></header>
      <div className="admin-toast-region" aria-live="polite">{feedback ? <p className="admin-feedback">{feedback}</p> : null}{error ? <p className="admin-error">{error}</p> : null}</div>

      {activePage === "dashboard" ? <div className="dashboard-screen-grid">
        <div className="dashboard-command-header"><div><span className="metric-eyebrow">LEAD CONVERSION COMMAND CENTRE</span><h2>Funnel Operating Surface</h2><p>Monitor live funnel movement, lead quality, booking health, and source performance.</p></div><div className="dashboard-controls"><label className="range-select-wrap"><span>Range</span><select value={range} onChange={(event) => setRange(event.target.value as DashboardRange)}>{DASHBOARD_RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>{range === "custom" ? <div className="custom-range-controls"><label><span>Start</span><input type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} /></label><label><span>End</span><input type="date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} /></label></div> : null}<span>{rangeLabel(range, reportingTimezone, selectedCustomRange)}</span><span>{lastUpdated ? `Last updated ${dateTime(lastUpdated, displayTimezone)}` : "Waiting for live data"}</span></div></div>
        <section className="kpi-grid command-kpis"><KpiCard label="Total Leads" eyebrow="PIPELINE VOLUME" value={kpis?.totalLeads || 0} caption="All leads in the selected range" accent="blue" icon="agent" isLoading={isLoading} /><KpiCard label="Qualified Leads" eyebrow="INTENT QUALITY" value={(kpis?.highIntentLeads || 0) + (kpis?.mediumIntentLeads || 0)} caption="High and medium intent leads" accent="amber" icon="spark" isLoading={isLoading} /><KpiCard label="Booking Clicked" eyebrow="BOOKING SIGNAL" value={kpis?.calendlyClicked || 0} caption="Visitors who clicked the booking CTA" accent="violet" icon="calendar" isLoading={isLoading} /><KpiCard label="Confirmed Booked" eyebrow="SUCCESS OUTCOME" value={kpis?.bookedCalls || 0} caption="Confirmed booked calls" accent="green" icon="check" isLoading={isLoading} /></section>
        <section className="dashboard-main-grid trend-grid"><LeadActivityTrend points={activityTrend} rangeText={rangeLabel(range, reportingTimezone, selectedCustomRange)} /><LeadSourceMix items={sourceMixItems} total={sourceMixTotal} /></section>
        <section className="dashboard-main-grid secondary-grid"><article className="admin-card chart-panel intent-panel accent-green"><PanelHeader eyebrow="LEAD DISTRIBUTION" title="Lead Intent Distribution" badge="Live Data" />{kpis?.totalLeads ? <DistributionBars items={intentItems} total={kpis.totalLeads} /> : <EmptyVisual message="No lead intent records exist for this range yet." />}</article><BookingConversionColumns shown={kpis?.calendlyShown || 0} clicked={kpis?.calendlyClicked || 0} booked={kpis?.bookedCalls || 0} manual={manualBookedCount} /></section>
        <section className="dashboard-main-grid compact-dashboard-row journey-activity-row"><LeadToBookingJourney funnel={funnel} shown={kpis?.calendlyShown || 0} clicked={kpis?.calendlyClicked || 0} booked={kpis?.bookedCalls || 0} manual={manualBookedCount} calendly={calendly} /><TodayActivityVisual activity={data?.todayActivity} needingActionToday={leadSummary.needingActionToday} /></section>
        <section className="dashboard-main-grid compact-dashboard-row score-project-row"><ScoreDonut items={scoreItems} total={scoreTotal} /><ProjectOverview ongoing={dashboardOngoingProjects} completed={dashboardCompletedProjects} onViewProjects={() => setActivePage("projects")} /></section>
        <section className="admin-card source-card"><h2>Source / UTM Performance</h2>{normalizedSources.length ? <div className="admin-table-wrap"><table><thead><tr><th>Source</th><th>Leads</th><th>High</th><th>Medium</th><th>Low</th><th>Offered</th><th>Clicked</th><th>Confirmed</th><th>Qualified %</th><th>Booked %</th></tr></thead><tbody>{normalizedSources.map((source, index) => <tr key={String(source?.source || index)}><td>{source?.source || "Unknown"}</td><td>{safeSourceNumber(source?.leads)}</td><td>{safeSourceNumber(source?.high)}</td><td>{safeSourceNumber(source?.medium)}</td><td>{safeSourceNumber(source?.low)}</td><td>{safeSourceNumber(source?.calendlyShown)}</td><td>{safeSourceNumber(source?.clicked)}</td><td>{safeSourceNumber(source?.confirmedBooked)}</td><td>{pct(safeSourceNumber(source?.qualifiedRate))}</td><td>{pct(safeSourceNumber(source?.bookedRate))}</td></tr>)}</tbody></table></div> : <p className="empty-state">No source or UTM data exists for this range yet.</p>}</section>
      </div> : null}

      {activePage === "pipeline" ? <><div className="filter-row pipeline-controls">{["scored", "all", "high", "medium", "low", "unscored"].map((filter) => <button className={scoreFilter === filter ? "active" : ""} key={filter} type="button" onClick={() => { setScoreFilter(filter); setSelectMode(false); }}>{filter === "all" ? "All Sessions" : filter}</button>)}<select value={conversationSize} onChange={(event) => { setConversationSize(event.target.value); localStorage.setItem("tq-admin-default-page-size", event.target.value); setSelectMode(false); }}>{["10", "20", "50", "all"].map((size) => <option key={size} value={size}>Show {size === "all" ? "All" : size}</option>)}</select><select value={conversationArchiveView} onChange={(event) => { setConversationArchiveView(event.target.value); setSelectMode(false); }}><option value="active">Active</option><option value="archived">Archived</option></select><button className="button button-secondary" type="button" onClick={() => setSelectMode(!selectMode)}>{selectMode ? "Done Selecting" : "Select"}</button><button className="button button-secondary" type="button" onClick={exportCsv}>Export CSV</button></div><p className="table-count">{conversationMeta.filteredCount} filtered, {conversationMeta.totalSessionCount} total sessions</p>{selectMode && selectedIds.length ? <div className="bulk-action-bar"><span>{selectedIds.length} selected</span><button className="button button-secondary compact-action" title={conversationArchiveView === "archived" ? "Restore selected" : "Archive selected"} aria-label={conversationArchiveView === "archived" ? "Restore selected" : "Archive selected"} type="button" onClick={() => void archiveSelected(conversationArchiveView !== "archived")}>{conversationArchiveView === "archived" ? "Restore Selected" : "Archive Selected"}</button><button className="button button-secondary compact-action danger" title="Delete selected" aria-label="Delete selected" type="button" onClick={() => void deleteSelected()}>Delete Selected</button></div> : null}<ConversationTable displayTimezone={displayTimezone} rows={conversations} selected={selectedIds} setSelected={setSelectedIds} selectMode={selectMode} onView={openDetail} /></> : null}

      {activePage === "projects" ? <><div className="segmented-tabs"><button className={projectView === "ongoing" ? "active" : ""} type="button" onClick={() => setProjectView("ongoing")}>Ongoing Projects</button><button className={projectView === "completed" ? "active" : ""} type="button" onClick={() => setProjectView("completed")}>Completed Projects</button></div><p className="table-count">{projectView === "ongoing" ? ongoingProjects.length : completedProjects.length} projects</p><ProjectTable displayTimezone={displayTimezone} leads={projectView === "ongoing" ? ongoingProjects : completedProjects} assignees={assignees} onUpdate={updateLead} onView={setProjectDetail} /></> : null}

      {activePage === "settings" ? <SettingsPanel browserTimezone={detectedTimezone} displayTimezonePreference={displayTimezonePreference} setDisplayTimezonePreference={setDisplayTimezonePreference} reportingTimezone={reportingTimezone} setReportingTimezone={setReportingTimezone} onSaveReportingTimezone={async () => { if (token) await adminFetch(token, "/api/admin/settings", { method: "PATCH", body: JSON.stringify({ reporting_timezone: reportingTimezone }) }); }} onLoadAssigneeUsage={loadAssigneeUsage} onDeleteAssignee={deleteAssignee} theme={theme} setTheme={setTheme} assignees={assignees} setAssignees={setAssignees} newAssignee={newAssignee} setNewAssignee={setNewAssignee} conversationSize={conversationSize} setConversationSize={setConversationSize} scoreFilter={scoreFilter} setScoreFilter={setScoreFilter} onSaved={() => setFeedback("Saved.")} onError={setFeedback} onOpenArchived={openArchivedData} onLogout={logout} /> : null}
    </div>
    {detail ? <LeadDetailModal key={detail.session.id} displayTimezone={displayTimezone} detail={detail} onClose={() => { selectedDetailSessionIdRef.current = null; setDetail(null); }} onUpdate={updateLead} onMoveToProjects={moveLeadToProjects} onArchive={() => void archiveSelected(true, [detail.session.id])} onDelete={() => void deleteSelected([detail.session.id])} onRetry={retryDetailLoad} /> : null}
    {projectDetail ? <ProjectDetail displayTimezone={displayTimezone} lead={projectDetail} onClose={() => setProjectDetail(null)} onUpdate={updateLead} onArchive={() => void updateLead(projectDetail.id, { archived_at: new Date().toISOString() })} onDelete={() => { if (window.confirm("Delete this project lead data? This is permanent.")) void updateLead(projectDetail.id, { archived_at: new Date().toISOString() }); }} /> : null}
    {archivedOpen ? <ArchivedDataModal displayTimezone={displayTimezone} rows={archivedRows} selected={archivedSelected} setSelected={setArchivedSelected} onClose={() => setArchivedOpen(false)} onRestore={(ids) => void archiveSelected(false, ids)} onDelete={(ids) => void deleteSelected(ids)} /> : null}
  </section>;
}

function ConversationTable({ rows, selected, setSelected, selectMode, onView, displayTimezone }: { rows: ConversationRow[]; selected: string[]; setSelected: (ids: string[]) => void; selectMode: boolean; onView: (row: ConversationRow) => void; displayTimezone: string }) {
  return <div className="admin-card admin-table-wrap lead-pipeline-table"><table><thead><tr>{selectMode ? <th><input aria-label="Select all visible leads" type="checkbox" checked={rows.length > 0 && selected.length === rows.length} onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])} /></th> : null}<th>Lead</th><th>Business</th><th>Score</th><th>Status</th><th>Main Problem</th><th>AI Summary</th><th>Last Activity</th><th>Actions</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr className="clickable-row" key={row.id} onClick={() => onView(row)}>{selectMode ? <td onClick={(event) => event.stopPropagation()}><input aria-label={`Select ${row.displayName}`} type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))} /></td> : null}<td><strong>{row.displayName}</strong><small>{row.email || "No email"}</small></td><td>{row.businessName || "No business"}</td><td><span className={scoreClass(row.score)}>{row.score}</span></td><td>{bookingTableStatus(row.calendlyStatus)}</td><td>{row.mainProblem || "Not captured"}</td><td className="summary-cell" title={row.summary || "No session summary yet."}><span className="summary-clamp">{row.summary || "No session summary yet."}</span></td><td>{dateTime(row.lastActivity, displayTimezone)}</td><td><button className="icon-action" type="button" title="View lead details" aria-label="View lead details" onClick={(event) => { event.stopPropagation(); onView(row); }}><Icon name="eye" /></button></td></tr>) : <tr><td colSpan={selectMode ? 9 : 8}><p className="empty-state">No lead sessions match this view.</p></td></tr>}</tbody></table></div>;
}

function ProjectTable({ leads, assignees, onUpdate, onView, displayTimezone }: { leads: LeadRow[]; assignees: string[]; onUpdate: (id: string, updates: Record<string, unknown>) => Promise<void>; onView: (lead: LeadRow) => void; displayTimezone: string }) {
  return <div className="admin-card admin-table-wrap projects-table"><table><thead><tr><th>Project</th><th>Client / Business</th><th>Assignee</th><th>Project Stage</th><th>Contract Status</th><th>Project Dates</th><th>Last Updated</th><th>Actions</th></tr></thead><tbody>{leads.length ? leads.map((lead) => <tr className="clickable-row" key={lead.id} onClick={() => onView(lead)}><td><strong>{lead.project_name || lead.business_name || "Client Project"}</strong><small>{lead.project_summary || lead.main_problem || "No project summary yet"}</small></td><td>{lead.business_name || lead.name || "Not captured"}</td><td onClick={(event) => event.stopPropagation()}><EditableCell value={lead.owner_name || ""} options={["", ...assignees]} onSave={(value) => onUpdate(lead.id, { owner_name: value })} /></td><td onClick={(event) => event.stopPropagation()}><EditableCell value={lead.project_stage || "Not Started"} options={["Not Started", "Discovery", "Planning", "Building", "Review", "Live", "On Hold", "Completed"]} onSave={(value) => onUpdate(lead.id, { project_stage: value })} /></td><td onClick={(event) => event.stopPropagation()}><EditableCell value={lead.contract_status || "Pending"} options={["Pending", "Signed", "Not Required", "Cancelled"]} onSave={(value) => onUpdate(lead.id, { contract_status: value })} /></td><td><b>From:</b> {dateOnly(lead.project_start_date)}<br /><b>To:</b> {dateOnly(lead.target_completion_date)}</td><td>{dateTime(lead.updated_at || lead.created_at, displayTimezone)}</td><td><button className="icon-action" type="button" title="Project details" aria-label="Project details" onClick={(event) => { event.stopPropagation(); onView(lead); }}><Icon name="eye" /></button></td></tr>) : <tr><td colSpan={8}><p className="empty-state">No projects yet. Move a qualified lead from Lead Pipeline to Projects.</p></td></tr>}</tbody></table></div>;
}


function ProjectDetail({ lead, onClose, onUpdate, onArchive, onDelete, displayTimezone: _displayTimezone }: { lead: LeadRow; onClose: () => void; onUpdate: (id: string, updates: Record<string, unknown>) => Promise<void>; onArchive: () => void; onDelete: () => void; displayTimezone: string }) {
  const [draft, setDraft] = useState({
    name: lead.name || "",
    email: lead.email || "",
    business_name: lead.business_name || "",
    phone: lead.phone || "",
    lead_score: lead.score || "unscored",
    booking_status: bookingDraftStatus(lead),
    tags: normalizeTags(lead.tags).join(", "),
    project_name: lead.project_name || "",
    project_summary: lead.project_summary || "",
    project_stage: lead.project_stage || "Not Started",
    contract_status: lead.contract_status || "Pending",
    owner_name: lead.owner_name || "",
    project_start_date: lead.project_start_date || "",
    target_completion_date: lead.target_completion_date || "",
    project_timeline: lead.project_timeline || "",
    internal_notes: lead.internal_notes || "",
    booking_notes: lead.booking_notes || "",
  });
  const [fieldError, setFieldError] = useState("");
  const [saving, setSaving] = useState(false);
  async function saveProject() {
    if (!isValidEmail(draft.email)) { setFieldError("Enter a valid email address."); return; }
    setFieldError("");
    setSaving(true);
    try {
      await onUpdate(lead.id, {
        name: draft.name,
        email: draft.email,
        business_name: draft.business_name,
        phone: draft.phone,
        lead_score: draft.lead_score === "unscored" ? null : draft.lead_score,
        tags: tagsFromInput(draft.tags),
        project_name: draft.project_name,
        project_summary: draft.project_summary,
        project_stage: draft.project_stage,
        contract_status: draft.contract_status,
        owner_name: draft.owner_name,
        project_start_date: draft.project_start_date,
        target_completion_date: draft.target_completion_date,
        project_timeline: draft.project_timeline,
        internal_notes: draft.internal_notes,
        booking_notes: draft.booking_notes,
        ...bookingUpdates(draft.booking_status),
      });
    } finally { setSaving(false); }
  }
  return <div className="admin-modal-layer" role="dialog" aria-modal="true"><button className="admin-modal-backdrop" type="button" onClick={onClose} aria-label="Close project details" /><section className="admin-modal admin-card workspace-modal"><div className="admin-modal-header"><div><span className={`project-pill ${stageClass(draft.project_stage)}`}>{draft.project_stage}</span><h2>{draft.project_name || draft.business_name || "Client Project"}</h2><p>{draft.name || "Primary contact not captured"} - {draft.email || "No email stored"}</p></div><div className="modal-header-actions"><button className="button button-primary" type="button" disabled={saving} onClick={() => void saveProject()}>{saving ? "Saving..." : "Update Project Fields"}</button><button className="button button-secondary" type="button" onClick={onClose}>Close</button></div></div><div className="admin-modal-body">{fieldError ? <p className="field-error modal-field-error">{fieldError}</p> : null}<p className="save-context">Update Project Fields saves project and lead/contact information together.</p><div className="modal-grid detail-grid"><article className="detail-form-card"><h3>Lead Contact</h3><label><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label><span>Email</span><input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label><label><span>Business</span><input value={draft.business_name} onChange={(event) => setDraft({ ...draft, business_name: event.target.value })} /></label><label><span>Phone</span><input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label><label><span>Score</span><select value={draft.lead_score} onChange={(event) => setDraft({ ...draft, lead_score: event.target.value as ScoreBucket })}>{SCORE_OPTIONS.map((item) => <option key={item} value={item}>{item === "unscored" ? "Unscored" : item[0].toUpperCase() + item.slice(1)}</option>)}</select></label><label><span>Booking</span><select value={draft.booking_status} onChange={(event) => setDraft({ ...draft, booking_status: event.target.value })}>{BOOKING_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Tags</span><input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} /></label></article><article className="detail-form-card"><h3>Project Information</h3><label><span>Project name</span><input value={draft.project_name} onChange={(event) => setDraft({ ...draft, project_name: event.target.value })} /></label><label><span>Assignee</span><input value={draft.owner_name} onChange={(event) => setDraft({ ...draft, owner_name: event.target.value })} /></label><label><span>Project stage</span><select className={`stage-select ${stageClass(draft.project_stage)}`} value={draft.project_stage} onChange={(event) => setDraft({ ...draft, project_stage: event.target.value })}>{PROJECT_STAGE_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Contract status</span><select value={draft.contract_status} onChange={(event) => setDraft({ ...draft, contract_status: event.target.value })}>{CONTRACT_STATUS_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>From</span><input type="date" value={draft.project_start_date} onChange={(event) => setDraft({ ...draft, project_start_date: event.target.value })} /></label><label><span>To</span><input type="date" value={draft.target_completion_date} onChange={(event) => setDraft({ ...draft, target_completion_date: event.target.value })} /></label></article><article className="detail-form-card"><h3>Summary / Milestones</h3><textarea value={draft.project_summary} onChange={(event) => setDraft({ ...draft, project_summary: event.target.value })} placeholder="Project summary" /><textarea value={draft.project_timeline} onChange={(event) => setDraft({ ...draft, project_timeline: event.target.value })} placeholder="Milestones / timeline" /></article><article className="detail-form-card"><h3>Project / Booking Notes</h3><textarea value={draft.internal_notes} onChange={(event) => setDraft({ ...draft, internal_notes: event.target.value })} placeholder="Project notes" /><textarea value={draft.booking_notes} onChange={(event) => setDraft({ ...draft, booking_notes: event.target.value })} placeholder="Booking notes" /></article></div><article className="modal-messages"><h3>Lead Context</h3><p>{lead.main_problem || "No lead context stored."}</p></article></div><div className="admin-modal-footer"><span className="modal-footer-spacer" /><button className="button button-secondary compact-action" type="button" onClick={onArchive}>Archive</button><button className="button button-secondary compact-action danger" type="button" onClick={onDelete}>Delete</button></div></section></div>;
}
function SettingsPanel({ theme, setTheme, assignees, setAssignees, newAssignee, setNewAssignee, conversationSize, setConversationSize, scoreFilter, setScoreFilter, displayTimezonePreference, setDisplayTimezonePreference, reportingTimezone, setReportingTimezone, browserTimezone, onSaveReportingTimezone, onLoadAssigneeUsage, onDeleteAssignee, onSaved, onError, onOpenArchived, onLogout }: { theme: string; setTheme: (value: string) => void; assignees: string[]; setAssignees: (value: string[]) => void; newAssignee: string; setNewAssignee: (value: string) => void; conversationSize: string; setConversationSize: (value: string) => void; scoreFilter: string; setScoreFilter: (value: string) => void; displayTimezonePreference: string; setDisplayTimezonePreference: (value: string) => void; reportingTimezone: string; setReportingTimezone: (value: string) => void; browserTimezone: string; onSaveReportingTimezone: () => Promise<void>; onLoadAssigneeUsage: (name: string) => Promise<AssigneeUsage>; onDeleteAssignee: (name: string, mode: AssigneeDeleteMode, replacementName?: string) => Promise<unknown>; onSaved: () => void; onError: (message: string) => void; onOpenArchived: () => void; onLogout: () => Promise<void> }) {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AssigneeUsage | null>(null);
  const [deleteMode, setDeleteMode] = useState<AssigneeDeleteMode | "">("");
  const [replacementName, setReplacementName] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const markDirty = () => setDirty(true);
  async function saveSettings() {
    setSaving(true);
    try {
      localStorage.setItem("tq-admin-assignees", JSON.stringify(assignees));
      localStorage.setItem("tq-admin-theme", theme);
      localStorage.setItem("tq-admin-default-page-size", conversationSize);
      localStorage.setItem("tq-admin-default-filter", scoreFilter);
      localStorage.setItem("tq-admin-display-timezone", displayTimezonePreference);
      localStorage.setItem("tq-admin-reporting-timezone", reportingTimezone);
      await onSaveReportingTimezone();
      setDirty(false);
      onSaved();
    } finally { window.setTimeout(() => setSaving(false), 250); }
  }
  async function beginDeleteAssignee(name: string) {
    setDeleteError("");
    try {
      const usage = await onLoadAssigneeUsage(name);
      setPendingDelete(usage);
      setDeleteMode(usage.affectedCount ? "" : "unused");
      setReplacementName("");
    } catch (error) {
      const message = (error as Error).message || "Assignee usage could not be loaded.";
      setDeleteError(message);
      onError(message);
    }
  }
  async function confirmDeleteAssignee() {
    if (!pendingDelete || !deleteMode) return;
    setDeleteBusy(true);
    try { await onDeleteAssignee(pendingDelete.assignee, deleteMode, replacementName || undefined); setPendingDelete(null); setDeleteError(""); onSaved(); }
    catch (error) { const message = (error as Error).message || "Assignee could not be deleted."; setDeleteError(message); onError(message); }
    finally { setDeleteBusy(false); }
  }
  const replacementOptions = assignees.filter((name) => name !== pendingDelete?.assignee);
  const canDelete = Boolean(pendingDelete && (pendingDelete.affectedCount === 0 || deleteMode === "unassign" || (deleteMode === "reassign" && replacementName)));
  return <><div className="settings-grid refined-settings-grid"><section className="admin-card preferences-card workspace-controls-card"><h2>Workspace Controls</h2><p>Manage account access and return to the public website.</p><div className="workspace-control-actions"><Link className="button button-secondary" to="/">Back to Website</Link><button className="button button-secondary account-action" type="button" onClick={() => void onLogout()}>Logout</button></div></section><section className="admin-card preferences-card"><h2>Team / Assignees</h2>{assignees.map((name, index) => <div className="assignee-row" key={name + "-" + index}><label><span>Display name</span><input value={name} onChange={(event) => { markDirty(); setAssignees(assignees.map((item, itemIndex) => itemIndex === index ? event.target.value : item)); }} /></label><button className="icon-action danger" type="button" title={"Delete " + name} aria-label={"Delete assignee " + name} onClick={() => void beginDeleteAssignee(name)}><Icon name="close" /></button></div>)}<div className="settings-add-row"><input placeholder="New assignee" value={newAssignee} onChange={(event) => setNewAssignee(event.target.value)} /><button className="button button-secondary" type="button" onClick={() => { const name = newAssignee.trim(); if (name) { markDirty(); setAssignees([...assignees, name]); setNewAssignee(""); } }}>Add</button></div><p>Delete unused assignees directly, or reassign active projects before removal.</p>{deleteError ? <p className="field-error">{deleteError}</p> : null}</section><section className="admin-card preferences-card preferences-tall-card"><h2>Preferences</h2><label><span>Theme</span><select value={theme} onChange={(event) => { markDirty(); setTheme(event.target.value); }}><option value="dark">Dark</option><option value="light">Light</option></select></label><label><span>Display Timezone</span><select value={displayTimezonePreference} onChange={(event) => { markDirty(); setDisplayTimezonePreference(event.target.value); }}><option value={DISPLAY_TIMEZONE_BROWSER}>Use Browser Timezone ({browserTimezone})</option>{TIMEZONE_OPTIONS.map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select></label><label><span>Reporting Timezone</span><select value={reportingTimezone} onChange={(event) => { markDirty(); setReportingTimezone(safeTimeZone(event.target.value)); }}>{TIMEZONE_OPTIONS.map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select></label><label><span>Default Lead Pipeline page size</span><select value={conversationSize} onChange={(event) => { markDirty(); setConversationSize(event.target.value); }}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label><label><span>Default Lead Pipeline filter</span><select value={scoreFilter} onChange={(event) => { markDirty(); setScoreFilter(event.target.value); }}><option value="scored">Scored</option><option value="all">All Sessions</option></select></label><label className="inline-setting"><input type="checkbox" onChange={markDirty} /> Compact table density</label><label className="inline-setting"><input type="checkbox" onChange={markDirty} /> Reduced motion</label><label className="inline-setting"><input type="checkbox" defaultChecked onChange={markDirty} /> Confirm before delete</label><label className="inline-setting"><input type="checkbox" defaultChecked onChange={markDirty} /> Confirm before archive</label><button className="button button-primary save-settings" type="button" disabled={!dirty || saving} onClick={() => void saveSettings()}>{saving ? "Saving..." : "Save Settings"}</button></section><section className="admin-card preferences-card data-management-card"><h2>Data Management</h2><div className="data-management-grid"><div className="settings-mini-card"><h3>Archived Data</h3><p>Archived leads are stored here.</p><button className="button button-secondary" type="button" onClick={onOpenArchived}>View Archived Data</button></div><div className="settings-mini-card"><h3>Lead Score Legend</h3><p><span className="score-badge score-high">High</span> Highest priority leads.</p><p><span className="score-badge score-medium">Medium</span> Qualified but less urgent.</p><p><span className="score-badge score-low">Low</span> Lower fit or unclear intent.</p></div><div className="settings-mini-card"><h3>Data Cleanup</h3><p>Archive non-actionable leads. Delete only test chats and unwanted internal test data.</p></div></div></section></div>{pendingDelete ? <div className="admin-modal-layer assignee-delete-layer" role="dialog" aria-modal="true"><button className="admin-modal-backdrop" type="button" onClick={() => setPendingDelete(null)} aria-label="Cancel assignee deletion" /><section className="admin-modal admin-card workspace-modal assignee-delete-modal"><div className="admin-modal-header"><div><h2>Delete Assignee</h2></div></div><div className="admin-modal-body"><p>{pendingDelete.affectedCount ? `${pendingDelete.assignee} is assigned to ${pendingDelete.projectCount} project${pendingDelete.projectCount === 1 ? "" : "s"}. Choose how to handle ${pendingDelete.projectCount === 1 ? "this project" : "these projects"} before deleting this assignee.` : `Delete ${pendingDelete.assignee}? This assignee is not assigned to any project.`}</p>{deleteError ? <p className="field-error">{deleteError}</p> : null}{pendingDelete.affectedCount ? <div className="assignee-delete-options"><label className="inline-setting"><input type="radio" name="assignee-delete-mode" checked={deleteMode === "reassign"} onChange={() => setDeleteMode("reassign")} /> Reassign projects to</label><select disabled={deleteMode !== "reassign"} value={replacementName} onChange={(event) => setReplacementName(event.target.value)}><option value="">Choose replacement</option>{replacementOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select><label className="inline-setting"><input type="radio" name="assignee-delete-mode" checked={deleteMode === "unassign"} onChange={() => setDeleteMode("unassign")} /> Set projects to Unassigned</label></div> : null}</div><div className="admin-modal-footer"><span className="modal-footer-spacer" /><button className="button button-secondary" type="button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="button button-secondary compact-action danger" type="button" disabled={!canDelete || deleteBusy} onClick={() => void confirmDeleteAssignee()}>{deleteBusy ? "Deleting..." : pendingDelete.affectedCount ? "Confirm and Delete Assignee" : "Delete Assignee"}</button></div></section></div> : null}</>;
}

function ArchivedDataModal({ rows, selected, setSelected, onClose, onRestore, onDelete, displayTimezone }: { rows: ConversationRow[]; selected: string[]; setSelected: (ids: string[]) => void; onClose: () => void; onRestore: (ids: string[]) => void; onDelete: (ids: string[]) => void; displayTimezone: string }) {
  const [viewing, setViewing] = useState<ConversationRow | null>(null);
  const allSelected = rows.length > 0 && selected.length === rows.length;
  return <div className="admin-modal-layer" role="dialog" aria-modal="true"><button className="admin-modal-backdrop" type="button" onClick={onClose} aria-label="Close archived data" /><section className="admin-modal admin-card workspace-modal archive-modal"><div className="admin-modal-header"><div><h2>Archived Data</h2><p>Archived leads are stored here.</p></div><button className="button button-secondary" type="button" onClick={onClose}>Close</button></div><div className="admin-modal-body archive-modal-body">{viewing ? <article className="archived-detail"><div><h3>{viewing.displayName}</h3><p><b>Business:</b> {viewing.businessName || "No business"}</p><p><b>Main Problem:</b> {viewing.mainProblem || "Not captured"}</p><p><b>AI Summary:</b> {viewing.summary || "No session summary yet."}</p></div><div><p><b>Score:</b> <span className={scoreClass(viewing.score)}>{viewing.score}</span></p><p><b>Archive date:</b> {dateTime(viewing.archivedAt, displayTimezone)}</p><p><b>Booking:</b> {bookingDetailStatus(viewing.calendlyStatus)}</p><p><b>Tags:</b> {normalizeTags(viewing.lead?.tags).join(", ") || "No tags"}</p></div><div className="archive-detail-actions"><button className="button button-secondary compact-action" type="button" onClick={() => setViewing(null)}>Back</button><button className="button button-secondary compact-action" type="button" onClick={() => onRestore([viewing.id])}>Restore</button><button className="button button-secondary compact-action danger" type="button" onClick={() => onDelete([viewing.id])}>Delete</button></div></article> : null}<div className="archive-actions"><button className="button button-secondary compact-action" type="button" disabled={!selected.length} onClick={() => onRestore(selected)}>Restore to Lead Pipeline</button><button className="button button-secondary compact-action danger" type="button" disabled={!selected.length} onClick={() => onDelete(selected)}>Delete Selected</button><button className="button button-secondary compact-action danger" type="button" disabled={!rows.length} onClick={() => { const phrase = window.prompt(`Type DELETE ${rows.length} to permanently delete all archived records.`); if (phrase === `DELETE ${rows.length}`) onDelete(rows.map((row) => row.id)); }}>Delete All</button></div><div className="admin-table-wrap lead-pipeline-table archive-table"><table><thead><tr><th><input type="checkbox" aria-label="Select all archived records" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])} /></th><th>Lead / Project</th><th>Business</th><th>Score</th><th>Main Problem</th><th>Archive date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}><td><input type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))} /></td><td>{row.displayName}</td><td>{row.businessName || "No business"}</td><td><span className={scoreClass(row.score)}>{row.score}</span></td><td className="archive-main-problem" title={row.mainProblem || "Not captured"}><span>{row.mainProblem || "Not captured"}</span></td><td>{dateTime(row.archivedAt, displayTimezone)}</td><td>{row.workflowStatus}</td><td className="archive-row-actions-cell"><div className="archive-row-actions"><button className="icon-action" type="button" title="View archived record" aria-label="View archived record" onClick={() => setViewing(row)}><Icon name="eye" /></button><button className="button button-secondary compact-action" type="button" onClick={() => onRestore([row.id])}>Restore</button><button className="button button-secondary compact-action danger" type="button" onClick={() => onDelete([row.id])}>Delete</button></div></td></tr>) : <tr><td colSpan={8}><p className="empty-state">No archived records found.</p></td></tr>}</tbody></table></div></div></section></div>;
}










