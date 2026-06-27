import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/ui/Icon";
import { supabase } from "../lib/supabase";
import { DEFAULT_REPORTING_TIMEZONE, DISPLAY_TIMEZONE_BROWSER, TIMEZONE_OPTIONS, browserTimeZone, formatDateOnly, formatDateTime, safeTimeZone } from "../lib/timezone";
import { fetchDashboardData, getDashboardRange, rangeLabel, type DashboardData, type DashboardRange, type ScoreBucket } from "./dashboardService";

const UNAUTHORIZED_MESSAGE = "This account does not have dashboard access.";
const PAGE_TITLES = { dashboard: "Dashboard", pipeline: "Lead Pipeline", projects: "Projects", settings: "Settings" } as const;
type PageKey = keyof typeof PAGE_TITLES;
type LeadRow = Record<string, any> & { id: string; score: ScoreBucket; workflowStatus: string; calendlyStatus: string; bookingSource: string; tags: string[] };
type ConversationRow = Record<string, any> & { id: string; leadId?: string; score: ScoreBucket; workflowStatus: string; calendlyStatus: string; summary?: string; archivedAt?: string | null };

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

function KpiCard({ label, value, isLoading }: { label: string; value: number; isLoading: boolean }) {
  return <article className="admin-card kpi-card fade-in"><span>{label}</span>{isLoading ? <div className="skeleton skeleton-number" /> : <strong>{value}</strong>}</article>;
}

function EditableCell({ value, onSave, type = "text", options }: { value?: string | null; type?: string; options?: string[]; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value || "");
  useEffect(() => setDraft(value || ""), [value]);
  if (options) return <select className={options.includes("Completed") ? `stage-select ${stageClass(draft)}` : ""} value={draft} onChange={(event) => { setDraft(event.target.value); onSave(event.target.value); }}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  return <input type={type} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => onSave(draft)} />;
}


function QualificationSummary({ signals, score }: { signals: any[]; score: string }) {
  const signal = latestSignal(signals);
  if (!signal) return <article className="modal-messages qualification-summary"><h3>Qualification Summary</h3><p>No qualification signals stored yet.</p></article>;
  return <article className="modal-messages qualification-summary"><h3>Qualification Summary</h3><div className="qualification-grid"><span>Has business</span><b>{yesNo(signal.has_business)}</b><span>Has traffic or spend</span><b>{yesNo(signal.has_traffic_or_spend)}</b><span>Problem clarity</span><b>{scoreLevel(signal.problem_clarity)}</b><span>Urgency</span><b>{scoreLevel(signal.urgency)}</b><span>Wants to book</span><b>{yesNo(signal.wants_to_book)}</b><span>Final score</span><b><span className={`qualification-final-score ${scoreClass(score)}`}>{score}</span></b></div>{signal.score_reason ? <p className="qualification-reason"><b>Score reason:</b> {signal.score_reason}</p> : null}</article>;
}

function LeadDetailModal({ detail, displayTimezone, onClose, onUpdate, onMoveToProjects, onArchive, onDelete }: { detail: any; displayTimezone: string; onClose: () => void; onUpdate: (id: string, updates: Record<string, unknown>) => Promise<void>; onMoveToProjects: (id: string, updates: Record<string, unknown>) => Promise<void>; onArchive: () => void; onDelete: () => void }) {
  const lead = detail.lead || {};
  const isAlreadyProject = Boolean(lead.completed_at) || detail.workflowStatus === "Completed";
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
      <div className="admin-modal-body">
        {fieldError ? <p className="field-error modal-field-error">{fieldError}</p> : null}
        <div className="modal-grid detail-grid">
          <article><h3>Read-only Profile</h3><p>Website: {lead.website || "Not captured"}</p><p>Main problem: {lead.main_problem || "Not captured"}</p><p>Desired outcome: {lead.desired_outcome || "Not captured"}</p><p>Owner: {lead.owner_name || "Unassigned"}</p><p>Follow-up due: {dateOnly(lead.follow_up_due_date)}</p></article>
          <article className="detail-form-card"><h3>Editable Lead Contact</h3><label><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label><span>Email</span><input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label><label><span>Business</span><input value={draft.business_name} onChange={(event) => setDraft({ ...draft, business_name: event.target.value })} /></label><label><span>Phone</span><input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label><label><span>Score</span><select value={draft.lead_score} onChange={(event) => setDraft({ ...draft, lead_score: event.target.value as ScoreBucket })}>{SCORE_OPTIONS.map((item) => <option key={item} value={item}>{item === "unscored" ? "Unscored" : item[0].toUpperCase() + item.slice(1)}</option>)}</select></label><label><span>Booking</span><select value={draft.booking_status} onChange={(event) => setDraft({ ...draft, booking_status: event.target.value })}>{BOOKING_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Tags</span><input value={draft.tags} placeholder="proposal, urgent" onChange={(event) => setDraft({ ...draft, tags: event.target.value })} /></label></article>
          <article><h3>Booking Truth</h3><p>Status: {bookingDetailStatus(detail.calendlyStatus)}</p><p>Booking source: {detail.bookingSource}</p><p>Booking time: {dateTime(lead.booking_datetime || lead.booked_at, displayTimezone)}</p><p>Manual edits are saved as lead updates and do not create Calendly events.</p></article>
          <article><h3>Activity Timeline</h3>{[...(detail.activity || []), ...(detail.funnelEvents || [])].slice(0, 12).length ? [...(detail.activity || []), ...(detail.funnelEvents || [])].slice(0, 12).map((event: any) => <p key={`${event.id}-${event.created_at}`}><b>{event.event_type}</b><br />{dateTime(event.created_at, displayTimezone)}</p>) : <p>No activity yet.</p>}</article>
        </div>
        <article className="modal-messages notes-card"><h3>Notes</h3><div className="notes-grid"><label><span>Admin Notes</span><textarea value={draft.internal_notes} onChange={(event) => setDraft({ ...draft, internal_notes: event.target.value })} /></label><label><span>Booking Notes</span><textarea value={draft.booking_notes} onChange={(event) => setDraft({ ...draft, booking_notes: event.target.value })} /></label></div></article>
        <article className="modal-messages"><h3>Project Tracking</h3><div className="project-grid"><input placeholder="Project name" value={draft.project_name} onChange={(event) => setDraft({ ...draft, project_name: event.target.value })} /><select className={`stage-select ${stageClass(draft.project_stage)}`} value={draft.project_stage} onChange={(event) => setDraft({ ...draft, project_stage: event.target.value })}>{PROJECT_STAGE_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select><select value={draft.contract_status} onChange={(event) => setDraft({ ...draft, contract_status: event.target.value })}>{CONTRACT_STATUS_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select><label><span>From</span><input type="date" value={draft.project_start_date} onChange={(event) => setDraft({ ...draft, project_start_date: event.target.value })} /></label><label><span>To</span><input type="date" value={draft.target_completion_date} onChange={(event) => setDraft({ ...draft, target_completion_date: event.target.value })} /></label><textarea placeholder="Timeline / milestones" value={draft.project_timeline} onChange={(event) => setDraft({ ...draft, project_timeline: event.target.value })} /><textarea placeholder="Project summary" value={draft.project_summary} onChange={(event) => setDraft({ ...draft, project_summary: event.target.value })} /></div></article>
        <article className="modal-messages"><h3>Recent Chat Messages</h3>{detail.messages?.length ? detail.messages.map((message: any) => <p key={message.id}><b>{message.role}:</b> {message.content}</p>) : <p>No messages found.</p>}</article>
        <QualificationSummary signals={detail.signals || []} score={draft.lead_score} />
      </div>
      <div className="admin-modal-footer"><button className="button button-secondary" type="button" disabled={isAlreadyProject || saving} onClick={() => void moveToProjects()}>{isAlreadyProject ? "Already in Projects" : "Move to Projects"}</button><span className="modal-footer-spacer" /><button className="button button-secondary compact-action" type="button" onClick={onArchive}>Archive</button><button className="button button-secondary compact-action danger" type="button" onClick={onDelete}>Delete</button></div>
    </section>
  </div>;
}
export default function Dashboard() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("tq-admin-theme") || "dark");
  const [detectedTimezone] = useState(browserTimeZone);
  const [displayTimezonePreference, setDisplayTimezonePreference] = useState(() => localStorage.getItem("tq-admin-display-timezone") || DISPLAY_TIMEZONE_BROWSER);
  const [reportingTimezone, setReportingTimezone] = useState(() => safeTimeZone(localStorage.getItem("tq-admin-reporting-timezone"), DEFAULT_REPORTING_TIMEZONE));
  const [range, setRange] = useState<DashboardRange>("today");
  const [data, setData] = useState<DashboardData | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
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
  const [detail, setDetail] = useState<any | null>(null);
  const [projectDetail, setProjectDetail] = useState<LeadRow | null>(null);
  const [projectView, setProjectView] = useState<"ongoing" | "completed">("ongoing");
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [archivedRows, setArchivedRows] = useState<ConversationRow[]>([]);
  const [archivedSelected, setArchivedSelected] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshingPage, setRefreshingPage] = useState<PageKey | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
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
  useEffect(() => { if (feedback === "Saved." || feedback === "Selection cleared.") { const timer = window.setTimeout(() => setFeedback(""), 3000); return () => window.clearTimeout(timer); } }, [feedback]);
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

  const handleAuthError = useCallback(async (loadError: unknown) => {
    const status = (loadError as Error & { status?: number }).status;
    if (status === 401) navigate("/admin/login", { replace: true });
    else if (status === 403) { await supabase.auth.signOut(); navigate("/admin/login", { replace: true, state: { message: UNAUTHORIZED_MESSAGE } }); }
    else setError((loadError as Error).message || "Admin data could not be loaded.");
  }, [navigate]);

  const displayTimezone = displayTimezonePreference === DISPLAY_TIMEZONE_BROWSER ? detectedTimezone : safeTimeZone(displayTimezonePreference, detectedTimezone);

  const loadDashboard = useCallback(async (nextToken = token, showLoading = true) => {
    if (!nextToken) return;
    if (showLoading) setIsLoading(true);
    setError("");
    try {
      const dashboardData = await fetchDashboardData(nextToken, range, reportingTimezone);
      const { start, end, timeZone } = getDashboardRange(range, reportingTimezone);
      const sourceData = await adminFetch<any[]>(nextToken, `/api/admin/sources?${new URLSearchParams({ start, end, timeZone })}`);
      setData(dashboardData); setSources(sourceData); setLastUpdated(new Date().toISOString());
    } catch (loadError) { await handleAuthError(loadError); }
    finally { setIsLoading(false); }
  }, [handleAuthError, range, reportingTimezone, token]);

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
    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) { navigate("/admin/login", { replace: true }); return; }
      setToken(accessToken);
      try {
        const settings = await adminFetch<any>(accessToken, "/api/admin/settings");
        if (settings.reporting_timezone) setReportingTimezone(safeTimeZone(settings.reporting_timezone));
      } catch (settingsError) {
        console.warn("Admin settings unavailable, using local timezone preferences.", settingsError);
      }
      await Promise.all([loadDashboard(accessToken), loadLeads(accessToken), loadConversations(accessToken)]);
    })();
  }, [loadConversations, loadDashboard, loadLeads, navigate]);
  useEffect(() => { if (token) void loadDashboard(token, false); }, [loadDashboard, range, reportingTimezone, token]);
  useEffect(() => { if (token) void loadLeads(token); }, [leadFilter, leadSearch, loadLeads, reportingTimezone, tagSearch, token]);
  useEffect(() => { if (token) void loadConversations(token); }, [scoreFilter, conversationSize, conversationArchiveView, loadConversations, token]);
  useEffect(() => { if (token && activePage === "projects") { setLeadFilter("completed"); } }, [activePage, token]);

  async function logout() { await supabase.auth.signOut(); sessionStorage.setItem("tq-admin-logout", "1"); navigate("/admin/login?logged_out=1", { replace: true, state: { loggedOut: true } }); }
  async function updateLead(id: string, updates: Record<string, unknown>) {
    if (!token) return;
    setFeedback("Saving...");
    try {
      const saved = await adminFetch<LeadRow>(token, `/api/admin/leads?id=${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(updates) });
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
  async function openDetail(sessionId: string) { if (!token) return; setDetail(await adminFetch(token, `/api/admin/conversation-detail?id=${encodeURIComponent(sessionId)}`)); }
  async function openArchivedData() { if (!token) return; const result = await adminFetch<any>(token, `/api/admin/conversations?${new URLSearchParams({ score: "all", pageSize: "all", archived: "archived" })}`); setArchivedRows(result.rows || []); setArchivedSelected([]); setArchivedOpen(true); }
  async function archiveSelected(archived: boolean, ids = selectedIds) { if (!token || !ids.length) return; await adminFetch(token, "/api/admin/conversations", { method: "PATCH", body: JSON.stringify({ ids, archived }) }); await loadConversations(); if (archivedOpen) await openArchivedData(); setFeedback(archived ? "Saved." : "Saved."); }
  async function deleteSelected(ids = selectedIds, confirmProtected = false) {
    if (!token || !ids.length) return;
    const ok = window.confirm("Deletion is permanent and may remove associated messages, funnel events, and operational conversation data. Continue?");
    if (!ok) return;
    try { await adminFetch(token, "/api/admin/conversations", { method: "DELETE", body: JSON.stringify({ ids, confirmProtected }) }); await loadConversations(); setFeedback("Conversation deleted."); }
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

  function printDashboard() {
    window.print();
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
  const scoreTotal = useMemo(() => scores ? scores.high + scores.medium + scores.low + scores.unscored : 0, [scores]);
  const completedLeads = leads.filter((lead) => lead.completed_at || lead.workflowStatus === "Completed");
  const visibleLeads = leadFilter === "completed" ? completedLeads : leads;
  const ongoingProjects = visibleLeads.filter((lead) => String(lead.project_stage || "Not Started") !== "Completed");
  const completedProjects = visibleLeads.filter((lead) => String(lead.project_stage || "Not Started") === "Completed");

  return <section className="admin-workspace">
    <button className={`admin-drawer-overlay ${drawerOpen ? "open" : ""}`} type="button" onClick={() => setDrawerOpen(false)} aria-label="Close navigation" />
    <aside className={`admin-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${drawerOpen ? "drawer-open" : ""}`}>
      <div className="sidebar-brand"><img src="/logo.png" alt="TechQuarters logo" /><button type="button" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}><Icon name={sidebarCollapsed ? "plus" : "minus"} /></button></div><button className="theme-icon-button" type="button" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><Icon name={theme === "dark" ? "sun" : "moon"} /><span>{theme === "dark" ? "Light mode" : "Dark mode"}</span></button>
      <nav>{(["dashboard", "pipeline", "projects", "settings"] as PageKey[]).map((page) => <button key={page} className={activePage === page ? "active" : ""} type="button" title={PAGE_TITLES[page]} onClick={() => { setActivePage(page); setDrawerOpen(false); }}><Icon name={iconFor(page)} /><span>{PAGE_TITLES[page]}</span></button>)}</nav>
    </aside>
    <div className="admin-main-shell">
      <header className={`admin-topbar page-accent-${activePage}`}><button className="mobile-nav-button" type="button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button><div className="page-title-wrap"><h1>{PAGE_TITLES[activePage]}</h1><button className="icon-action title-refresh" type="button" title={`Refresh ${PAGE_TITLES[activePage]}`} aria-label={`Refresh ${PAGE_TITLES[activePage]}`} disabled={refreshingPage === activePage} onClick={() => void refreshActivePage()}><Icon className={refreshingPage === activePage ? "spin" : ""} name="refresh" /></button><p>TechQuarters Chatbot Dashboard</p></div><div className="topbar-actions"><Link className="button button-secondary" to="/">Back to Website</Link><button className="button button-secondary" type="button" onClick={logout}>Logout</button></div></header>
      <div className="admin-toast-region" aria-live="polite">{feedback ? <p className="admin-feedback">{feedback}</p> : null}{error ? <p className="admin-error">{error}</p> : null}</div>

      {activePage === "dashboard" ? <div className="dashboard-print-report">
        <header className="dashboard-print-header"><h1>Dashboard</h1><p>{rangeLabel(range, reportingTimezone)}</p><p>Reporting timezone: {reportingTimezone}</p><p>Generated: {dateTime(new Date().toISOString(), reportingTimezone)}</p></header>
        <div className="dashboard-controls"><div className="range-tabs" aria-label="Dashboard date range">{(["today", "week", "month"] as DashboardRange[]).map((item) => <button className={range === item ? "active" : ""} key={item} onClick={() => setRange(item)} type="button">{item === "today" ? "Today" : item === "week" ? "This Week" : "This Month"}</button>)}</div><span>{rangeLabel(range, reportingTimezone)}</span><span>{lastUpdated ? `Last updated ${dateTime(lastUpdated, displayTimezone)}` : "Waiting for live data"}</span><button className="button button-secondary compact-action print-dashboard-button" type="button" onClick={printDashboard} title="Print dashboard" aria-label="Print dashboard"><Icon name="print" /> Print Dashboard</button></div>
        <section className="kpi-grid simplified"><KpiCard label="Total Leads" value={kpis?.totalLeads || 0} isLoading={isLoading} /><article className="admin-card overview-card fade-in"><h2>Lead Intent Overview</h2><div className="status-stack"><div className="status-metric high"><span>High Intent</span><strong>{kpis?.highIntentLeads || 0}</strong><small>{pct(kpis?.totalLeads ? ((kpis?.highIntentLeads || 0) / kpis.totalLeads) * 100 : 0)}</small></div><div className="status-metric medium"><span>Medium Intent</span><strong>{kpis?.mediumIntentLeads || 0}</strong><small>{pct(kpis?.totalLeads ? ((kpis?.mediumIntentLeads || 0) / kpis.totalLeads) * 100 : 0)}</small></div><div className="status-metric low"><span>Low Intent</span><strong>{kpis?.lowIntentLeads || 0}</strong><small>{pct(kpis?.totalLeads ? ((kpis?.lowIntentLeads || 0) / kpis.totalLeads) * 100 : 0)}</small></div></div></article><article className="admin-card overview-card fade-in"><h2>Booking Journey</h2><div className="status-stack booking"><div className="status-metric offered"><span>Booking Offered</span><strong>{kpis?.calendlyShown || 0}</strong></div><div className="status-metric clicked"><span>Booking Clicked</span><strong>{kpis?.calendlyClicked || 0}</strong></div><div className="status-metric booked"><span>Confirmed Booked</span><strong>{kpis?.bookedCalls || 0}</strong></div><div className="status-metric manual"><span>Manually Marked Booked</span><strong>{conversations.filter((row) => row.calendlyStatus === "Manually Marked Booked").length}</strong></div></div></article></section>
        <section className="dashboard-main-grid"><article className="admin-card funnel-card"><div className="dashboard-card-heading"><h2>Landed &gt; Engaged &gt; Qualified &gt; Booked</h2><span>Overall booked: {pct(funnel?.conversions.overallBooked || 0)}</span></div><div className="funnel-steps">{["landed", "engaged", "qualified", "booked"].map((stage) => <div key={stage}><strong>{(funnel?.stages as any)?.[stage] || 0}</strong><span>{stage}</span></div>)}</div></article><article className="admin-card activity-card"><h2>Today&apos;s Activity</h2><div className="activity-grid"><div><span>Website Visitors Today</span><strong>{data?.todayActivity?.websiteVisitors || 0}</strong></div><div><span>Visitors Who Clicked Chat Today</span><strong>{data?.todayActivity?.chatClicked || 0}</strong></div><div><span>Opened a Conversation Today</span><strong>{data?.todayActivity?.conversationsOpened || 0}</strong></div><div><span>Leads Needing Action Today</span><strong>{leadSummary.needingActionToday}</strong></div></div></article></section>
        <section className="dashboard-main-grid secondary-grid"><article className="admin-card conversion-card"><h2>Booking Conversion</h2><div className="conversion-grid"><div><strong>{calendly?.shown || 0}</strong><span>Offered</span></div><div><strong>{calendly?.clicked || 0}</strong><span>Clicked</span></div><div><strong>{calendly?.booked || 0}</strong><span>Confirmed booked</span></div></div><p>Offered &gt; Clicked: {pct(calendly?.shownToClicked || 0)}</p><p>Clicked &gt; Booked: {pct(calendly?.clickedToBooked || 0)}</p><p>Offered &gt; Booked: {pct(calendly?.shownToBooked || 0)}</p></article><article className="admin-card score-breakdown"><h2>Lead Score Breakdown</h2>{scores ? (["high", "medium", "low", "unscored"] as const).map((score) => <div className="score-row" key={score}><span className={scoreClass(score)}>{score}</span><div><i style={{ width: `${scoreTotal ? (scores[score] / scoreTotal) * 100 : 0}%` }} /></div><b>{scores[score]}</b></div>) : <p>No lead scores in this range.</p>}</article></section>
        <section className="admin-card source-card"><h2>Source / UTM Performance</h2>{sources.length ? <div className="admin-table-wrap"><table><thead><tr><th>Source</th><th>Leads</th><th>High</th><th>Medium</th><th>Low</th><th>Offered</th><th>Clicked</th><th>Confirmed</th><th>Qualified %</th><th>Booked %</th></tr></thead><tbody>{sources.map((source) => <tr key={source.source}><td>{source.source}</td><td>{source.leads}</td><td>{source.high}</td><td>{source.medium}</td><td>{source.low}</td><td>{source.calendlyShown}</td><td>{source.clicked}</td><td>{source.confirmedBooked}</td><td>{pct(source.qualifiedRate)}</td><td>{pct(source.bookedRate)}</td></tr>)}</tbody></table></div> : <p className="empty-state">No source or UTM data exists for this range yet.</p>}</section><footer className="dashboard-print-footer"><span>TechQuarters Chatbot Dashboard</span><span>Generated: {dateTime(new Date().toISOString(), reportingTimezone)}</span></footer>
      </div> : null}

      {activePage === "pipeline" ? <><div className="filter-row pipeline-controls">{["scored", "all", "high", "medium", "low", "unscored"].map((filter) => <button className={scoreFilter === filter ? "active" : ""} key={filter} type="button" onClick={() => { setScoreFilter(filter); setSelectMode(false); }}>{filter === "all" ? "All Sessions" : filter}</button>)}<select value={conversationSize} onChange={(event) => { setConversationSize(event.target.value); localStorage.setItem("tq-admin-default-page-size", event.target.value); setSelectMode(false); }}>{["10", "20", "50", "all"].map((size) => <option key={size} value={size}>Show {size === "all" ? "All" : size}</option>)}</select><select value={conversationArchiveView} onChange={(event) => { setConversationArchiveView(event.target.value); setSelectMode(false); }}><option value="active">Active</option><option value="archived">Archived</option></select><button className="button button-secondary" type="button" onClick={() => setSelectMode(!selectMode)}>{selectMode ? "Done Selecting" : "Select"}</button><button className="button button-secondary" type="button" onClick={exportCsv}>Export CSV</button></div><p className="table-count">{conversationMeta.filteredCount} filtered, {conversationMeta.totalSessionCount} total sessions</p>{selectMode && selectedIds.length ? <div className="bulk-action-bar"><span>{selectedIds.length} selected</span><button className="button button-secondary compact-action" title={conversationArchiveView === "archived" ? "Restore selected" : "Archive selected"} aria-label={conversationArchiveView === "archived" ? "Restore selected" : "Archive selected"} type="button" onClick={() => void archiveSelected(conversationArchiveView !== "archived")}>{conversationArchiveView === "archived" ? "Restore Selected" : "Archive Selected"}</button><button className="button button-secondary compact-action danger" title="Delete selected" aria-label="Delete selected" type="button" onClick={() => void deleteSelected()}>Delete Selected</button></div> : null}<ConversationTable displayTimezone={displayTimezone} rows={conversations} selected={selectedIds} setSelected={setSelectedIds} selectMode={selectMode} onView={openDetail} /></> : null}

      {activePage === "projects" ? <><div className="segmented-tabs"><button className={projectView === "ongoing" ? "active" : ""} type="button" onClick={() => setProjectView("ongoing")}>Ongoing Projects</button><button className={projectView === "completed" ? "active" : ""} type="button" onClick={() => setProjectView("completed")}>Completed Projects</button></div><p className="table-count">{projectView === "ongoing" ? ongoingProjects.length : completedProjects.length} projects</p><ProjectTable displayTimezone={displayTimezone} leads={projectView === "ongoing" ? ongoingProjects : completedProjects} assignees={assignees} onUpdate={updateLead} onView={setProjectDetail} /></> : null}

      {activePage === "settings" ? <SettingsPanel browserTimezone={detectedTimezone} displayTimezonePreference={displayTimezonePreference} setDisplayTimezonePreference={setDisplayTimezonePreference} reportingTimezone={reportingTimezone} setReportingTimezone={setReportingTimezone} onSaveReportingTimezone={async () => { if (token) await adminFetch(token, "/api/admin/settings", { method: "PATCH", body: JSON.stringify({ reporting_timezone: reportingTimezone }) }); }} onLoadAssigneeUsage={loadAssigneeUsage} onDeleteAssignee={deleteAssignee} theme={theme} setTheme={setTheme} assignees={assignees} setAssignees={setAssignees} newAssignee={newAssignee} setNewAssignee={setNewAssignee} conversationSize={conversationSize} setConversationSize={setConversationSize} scoreFilter={scoreFilter} setScoreFilter={setScoreFilter} onSaved={() => setFeedback("Saved.")} onError={setFeedback} onOpenArchived={openArchivedData} /> : null}
    </div>
    {detail ? <LeadDetailModal displayTimezone={displayTimezone} detail={detail} onClose={() => setDetail(null)} onUpdate={updateLead} onMoveToProjects={moveLeadToProjects} onArchive={() => void archiveSelected(true, [detail.session.id])} onDelete={() => void deleteSelected([detail.session.id])} /> : null}
    {projectDetail ? <ProjectDetail displayTimezone={displayTimezone} lead={projectDetail} onClose={() => setProjectDetail(null)} onUpdate={updateLead} onArchive={() => void updateLead(projectDetail.id, { archived_at: new Date().toISOString() })} onDelete={() => { if (window.confirm("Delete this project lead data? This is permanent.")) void updateLead(projectDetail.id, { archived_at: new Date().toISOString() }); }} /> : null}
    {archivedOpen ? <ArchivedDataModal displayTimezone={displayTimezone} rows={archivedRows} selected={archivedSelected} setSelected={setArchivedSelected} onClose={() => setArchivedOpen(false)} onRestore={(ids) => void archiveSelected(false, ids)} onDelete={(ids) => void deleteSelected(ids)} /> : null}
  </section>;
}

function ConversationTable({ rows, selected, setSelected, selectMode, onView, displayTimezone }: { rows: ConversationRow[]; selected: string[]; setSelected: (ids: string[]) => void; selectMode: boolean; onView: (id: string) => void; displayTimezone: string }) {
  return <div className="admin-card admin-table-wrap lead-pipeline-table"><table><thead><tr>{selectMode ? <th><input aria-label="Select all visible leads" type="checkbox" checked={rows.length > 0 && selected.length === rows.length} onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])} /></th> : null}<th>Lead</th><th>Business</th><th>Score</th><th>Status</th><th>Main Problem</th><th>AI Summary</th><th>Last Activity</th><th>Actions</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr className="clickable-row" key={row.id} onClick={() => onView(row.id)}>{selectMode ? <td onClick={(event) => event.stopPropagation()}><input aria-label={`Select ${row.displayName}`} type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))} /></td> : null}<td><strong>{row.displayName}</strong><small>{row.email || "No email"}</small></td><td>{row.businessName || "No business"}</td><td><span className={scoreClass(row.score)}>{row.score}</span></td><td>{bookingTableStatus(row.calendlyStatus)}</td><td>{row.mainProblem || "Not captured"}</td><td className="summary-cell" title={row.summary || "No session summary yet."}><span className="summary-clamp">{row.summary || "No session summary yet."}</span></td><td>{dateTime(row.lastActivity, displayTimezone)}</td><td><button className="icon-action" type="button" title="View lead details" aria-label="View lead details" onClick={(event) => { event.stopPropagation(); onView(row.id); }}><Icon name="eye" /></button></td></tr>) : <tr><td colSpan={selectMode ? 9 : 8}><p className="empty-state">No lead sessions match this view.</p></td></tr>}</tbody></table></div>;
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
function SettingsPanel({ theme, setTheme, assignees, setAssignees, newAssignee, setNewAssignee, conversationSize, setConversationSize, scoreFilter, setScoreFilter, displayTimezonePreference, setDisplayTimezonePreference, reportingTimezone, setReportingTimezone, browserTimezone, onSaveReportingTimezone, onLoadAssigneeUsage, onDeleteAssignee, onSaved, onError, onOpenArchived }: { theme: string; setTheme: (value: string) => void; assignees: string[]; setAssignees: (value: string[]) => void; newAssignee: string; setNewAssignee: (value: string) => void; conversationSize: string; setConversationSize: (value: string) => void; scoreFilter: string; setScoreFilter: (value: string) => void; displayTimezonePreference: string; setDisplayTimezonePreference: (value: string) => void; reportingTimezone: string; setReportingTimezone: (value: string) => void; browserTimezone: string; onSaveReportingTimezone: () => Promise<void>; onLoadAssigneeUsage: (name: string) => Promise<AssigneeUsage>; onDeleteAssignee: (name: string, mode: AssigneeDeleteMode, replacementName?: string) => Promise<unknown>; onSaved: () => void; onError: (message: string) => void; onOpenArchived: () => void }) {
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
  return <><div className="settings-grid"><section className="admin-card preferences-card"><h2>Team / Assignees</h2>{assignees.map((name, index) => <div className="assignee-row" key={name + "-" + index}><label><span>Display name</span><input value={name} onChange={(event) => { markDirty(); setAssignees(assignees.map((item, itemIndex) => itemIndex === index ? event.target.value : item)); }} /></label><button className="icon-action danger" type="button" title={"Delete " + name} aria-label={"Delete assignee " + name} onClick={() => void beginDeleteAssignee(name)}><Icon name="close" /></button></div>)}<div className="settings-add-row"><input placeholder="New assignee" value={newAssignee} onChange={(event) => setNewAssignee(event.target.value)} /><button className="button button-secondary" type="button" onClick={() => { const name = newAssignee.trim(); if (name) { markDirty(); setAssignees([...assignees, name]); setNewAssignee(""); } }}>Add</button></div><p>Delete unused assignees directly, or reassign active projects before removal.</p>{deleteError ? <p className="field-error">{deleteError}</p> : null}</section><section className="admin-card preferences-card"><h2>Preferences</h2><label><span>Theme</span><select value={theme} onChange={(event) => { markDirty(); setTheme(event.target.value); }}><option value="dark">Dark</option><option value="light">Light</option></select></label><label><span>Display Timezone</span><select value={displayTimezonePreference} onChange={(event) => { markDirty(); setDisplayTimezonePreference(event.target.value); }}><option value={DISPLAY_TIMEZONE_BROWSER}>Use Browser Timezone ({browserTimezone})</option>{TIMEZONE_OPTIONS.map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select></label><label><span>Reporting Timezone</span><select value={reportingTimezone} onChange={(event) => { markDirty(); setReportingTimezone(safeTimeZone(event.target.value)); }}>{TIMEZONE_OPTIONS.map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select></label><label><span>Default Lead Pipeline page size</span><select value={conversationSize} onChange={(event) => { markDirty(); setConversationSize(event.target.value); }}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label><label><span>Default Lead Pipeline filter</span><select value={scoreFilter} onChange={(event) => { markDirty(); setScoreFilter(event.target.value); }}><option value="scored">Scored</option><option value="all">All Sessions</option></select></label><label className="inline-setting"><input type="checkbox" onChange={markDirty} /> Compact table density</label><label className="inline-setting"><input type="checkbox" onChange={markDirty} /> Reduced motion</label><label className="inline-setting"><input type="checkbox" defaultChecked onChange={markDirty} /> Confirm before delete</label><label className="inline-setting"><input type="checkbox" defaultChecked onChange={markDirty} /> Confirm before archive</label><button className="button button-primary save-settings" type="button" disabled={!dirty || saving} onClick={() => void saveSettings()}>{saving ? "Saving..." : "Save Settings"}</button></section><section className="admin-card preferences-card"><h2>Archived Data</h2><p>Archived leads are stored here.</p><button className="button button-secondary" type="button" onClick={onOpenArchived}>View Archived Data</button><h2>Lead Score Legend</h2><p><span className="score-badge score-high">High</span> Highest priority leads.</p><p><span className="score-badge score-medium">Medium</span> Qualified but less urgent.</p><p><span className="score-badge score-low">Low</span> Lower fit or unclear intent.</p><h2>Data Cleanup</h2><p>Archive non-actionable leads. Delete only test chats and unwanted internal test data.</p></section></div>{pendingDelete ? <div className="admin-modal-layer assignee-delete-layer" role="dialog" aria-modal="true"><button className="admin-modal-backdrop" type="button" onClick={() => setPendingDelete(null)} aria-label="Cancel assignee deletion" /><section className="admin-modal admin-card workspace-modal assignee-delete-modal"><div className="admin-modal-header"><div><h2>Delete Assignee</h2></div></div><div className="admin-modal-body"><p>{pendingDelete.affectedCount ? `${pendingDelete.assignee} is assigned to ${pendingDelete.projectCount} project${pendingDelete.projectCount === 1 ? "" : "s"}. Choose how to handle ${pendingDelete.projectCount === 1 ? "this project" : "these projects"} before deleting this assignee.` : `Delete ${pendingDelete.assignee}? This assignee is not assigned to any project.`}</p>{deleteError ? <p className="field-error">{deleteError}</p> : null}{pendingDelete.affectedCount ? <div className="assignee-delete-options"><label className="inline-setting"><input type="radio" name="assignee-delete-mode" checked={deleteMode === "reassign"} onChange={() => setDeleteMode("reassign")} /> Reassign projects to</label><select disabled={deleteMode !== "reassign"} value={replacementName} onChange={(event) => setReplacementName(event.target.value)}><option value="">Choose replacement</option>{replacementOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select><label className="inline-setting"><input type="radio" name="assignee-delete-mode" checked={deleteMode === "unassign"} onChange={() => setDeleteMode("unassign")} /> Set projects to Unassigned</label></div> : null}</div><div className="admin-modal-footer"><span className="modal-footer-spacer" /><button className="button button-secondary" type="button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="button button-secondary compact-action danger" type="button" disabled={!canDelete || deleteBusy} onClick={() => void confirmDeleteAssignee()}>{deleteBusy ? "Deleting..." : pendingDelete.affectedCount ? "Confirm and Delete Assignee" : "Delete Assignee"}</button></div></section></div> : null}</>;
}

function ArchivedDataModal({ rows, selected, setSelected, onClose, onRestore, onDelete, displayTimezone }: { rows: ConversationRow[]; selected: string[]; setSelected: (ids: string[]) => void; onClose: () => void; onRestore: (ids: string[]) => void; onDelete: (ids: string[]) => void; displayTimezone: string }) {
  const [viewing, setViewing] = useState<ConversationRow | null>(null);
  const allSelected = rows.length > 0 && selected.length === rows.length;
  return <div className="admin-modal-layer" role="dialog" aria-modal="true"><button className="admin-modal-backdrop" type="button" onClick={onClose} aria-label="Close archived data" /><section className="admin-modal admin-card workspace-modal archive-modal"><div className="admin-modal-header"><div><h2>Archived Data</h2><p>Archived leads are stored here.</p></div><button className="button button-secondary" type="button" onClick={onClose}>Close</button></div><div className="admin-modal-body archive-modal-body">{viewing ? <article className="archived-detail"><div><h3>{viewing.displayName}</h3><p><b>Business:</b> {viewing.businessName || "No business"}</p><p><b>Main Problem:</b> {viewing.mainProblem || "Not captured"}</p><p><b>AI Summary:</b> {viewing.summary || "No session summary yet."}</p></div><div><p><b>Score:</b> <span className={scoreClass(viewing.score)}>{viewing.score}</span></p><p><b>Archive date:</b> {dateTime(viewing.archivedAt, displayTimezone)}</p><p><b>Booking:</b> {bookingDetailStatus(viewing.calendlyStatus)}</p><p><b>Tags:</b> {normalizeTags(viewing.lead?.tags).join(", ") || "No tags"}</p></div><div className="archive-detail-actions"><button className="button button-secondary compact-action" type="button" onClick={() => setViewing(null)}>Back</button><button className="button button-secondary compact-action" type="button" onClick={() => onRestore([viewing.id])}>Restore</button><button className="button button-secondary compact-action danger" type="button" onClick={() => onDelete([viewing.id])}>Delete</button></div></article> : null}<div className="archive-actions"><button className="button button-secondary compact-action" type="button" disabled={!selected.length} onClick={() => onRestore(selected)}>Restore to Lead Pipeline</button><button className="button button-secondary compact-action danger" type="button" disabled={!selected.length} onClick={() => onDelete(selected)}>Delete Selected</button><button className="button button-secondary compact-action danger" type="button" disabled={!rows.length} onClick={() => { const phrase = window.prompt(`Type DELETE ${rows.length} to permanently delete all archived records.`); if (phrase === `DELETE ${rows.length}`) onDelete(rows.map((row) => row.id)); }}>Delete All</button></div><div className="admin-table-wrap lead-pipeline-table archive-table"><table><thead><tr><th><input type="checkbox" aria-label="Select all archived records" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])} /></th><th>Lead / Project</th><th>Business</th><th>Score</th><th>Main Problem</th><th>Archive date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}><td><input type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))} /></td><td>{row.displayName}</td><td>{row.businessName || "No business"}</td><td><span className={scoreClass(row.score)}>{row.score}</span></td><td className="archive-main-problem" title={row.mainProblem || "Not captured"}><span>{row.mainProblem || "Not captured"}</span></td><td>{dateTime(row.archivedAt, displayTimezone)}</td><td>{row.workflowStatus}</td><td className="archive-row-actions-cell"><div className="archive-row-actions"><button className="icon-action" type="button" title="View archived record" aria-label="View archived record" onClick={() => setViewing(row)}><Icon name="eye" /></button><button className="button button-secondary compact-action" type="button" onClick={() => onRestore([row.id])}>Restore</button><button className="button button-secondary compact-action danger" type="button" onClick={() => onDelete([row.id])}>Delete</button></div></td></tr>) : <tr><td colSpan={8}><p className="empty-state">No archived records found.</p></td></tr>}</tbody></table></div></div></section></div>;
}