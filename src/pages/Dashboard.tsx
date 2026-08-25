import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  DEFAULT_REPORTING_TIMEZONE,
  DISPLAY_TIMEZONE_BROWSER,
  browserTimeZone,
  formatDateOnly,
  safeTimeZone,
} from "../lib/timezone";
import {
  fetchDashboardData,
  getDashboardRange,
  rangeLabel,
  adminFetch,
  leadDetailShell,
  scoreBucket,
  todayKey,
  PAGE_TITLES,
  type PageKey,
  type DashboardRange,
  type DashboardCustomRange,
  type DashboardData,
  type LeadRow,
  type ConversationRow,
  type LeadDetailState,
  type AssigneeUsage,
  type AssigneeDeleteMode,
} from "./dashboardService";

// Layout components
import DashboardSidebar from "../components/dashboard/layout/DashboardSidebar";
import DashboardHeader from "../components/dashboard/layout/DashboardHeader";

// Analytics components
import KpiCardGrid from "../components/dashboard/analytics/KpiCardGrid";
import LeadActivityTrend, { type TrendPoint } from "../components/dashboard/analytics/LeadActivityTrend";
import FunnelJourneyCard from "../components/dashboard/analytics/FunnelJourneyCard";
import SourceMixChart, { type SourceMixItem } from "../components/dashboard/analytics/SourceMixChart";
import IntentBreakdownCard from "../components/dashboard/analytics/IntentBreakdownCard";
import BookingConversionChart from "../components/dashboard/analytics/BookingConversionChart";
import TodayActivityCard from "../components/dashboard/analytics/TodayActivityCard";
import SourcesTable from "../components/dashboard/analytics/SourcesTable";

// Pipeline components
import PipelineView from "../components/dashboard/pipeline/PipelineView";
import LeadDetailDrawer from "../components/dashboard/pipeline/LeadDetailDrawer";

// Projects components
import ProjectsView from "../components/dashboard/projects/ProjectsView";
import ProjectDetailDrawer from "../components/dashboard/projects/ProjectDetailDrawer";

// Settings components
import SettingsView from "../components/dashboard/settings/SettingsView";
import ArchivedDataModal from "../components/dashboard/settings/ArchivedDataModal";

// Scoped Dashboard Styles
import "../styles/dashboard.css";

const UNAUTHORIZED_MESSAGE = "This account does not have dashboard access.";
const SESSION_EXPIRED_MESSAGE = "Your session expired. Please sign in again.";

function isInvalidRefreshTokenError(error: unknown) {
  const typedError = error as { message?: string; status?: number; __isAuthError?: boolean };
  const message = (typedError.message || "").toLowerCase();
  return (
    (typedError.status === 400 && message.includes("refresh") && message.includes("token")) ||
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found")
  );
}

async function signOutLocally() {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) console.warn("Local admin sign-out cleanup failed.", error);
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
  const [displayTimezonePreference, setDisplayTimezonePreference] = useState(
    () => localStorage.getItem("tq-admin-display-timezone") || DISPLAY_TIMEZONE_BROWSER
  );
  const [reportingTimezone, setReportingTimezone] = useState(() =>
    safeTimeZone(localStorage.getItem("tq-admin-reporting-timezone"), DEFAULT_REPORTING_TIMEZONE)
  );

  const [range, setRange] = useState<DashboardRange>("today");
  const [customStartDate, setCustomStartDate] = useState(todayKey());
  const [customEndDate, setCustomEndDate] = useState("");

  const [data, setData] = useState<DashboardData | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [conversationMeta, setConversationMeta] = useState({ totalSessionCount: 0, filteredCount: 0 });

  const [scoreFilter, setScoreFilter] = useState(localStorage.getItem("tq-admin-default-filter") || "scored");
  const [conversationSize, setConversationSize] = useState(
    localStorage.getItem("tq-admin-default-page-size") || "20"
  );
  const [conversationArchiveView, setConversationArchiveView] = useState("active");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [assignees, setAssignees] = useState<string[]>(() =>
    JSON.parse(localStorage.getItem("tq-admin-assignees") || '["Axell","Kaan"]')
  );
  const [newAssignee, setNewAssignee] = useState("");

  const [detail, setDetail] = useState<LeadDetailState | null>(null);
  const [projectDetail, setProjectDetail] = useState<LeadRow | null>(null);
  const [projectView, setProjectView] = useState<"ongoing" | "completed">("ongoing");

  const [archivedOpen, setArchivedOpen] = useState(false);
  const [archivedRows, setArchivedRows] = useState<ConversationRow[]>([]);
  const [archivedSelected, setArchivedSelected] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [leadSummary, setLeadSummary] = useState({ filteredCount: 0, totalLeadCount: 0, needingActionToday: 0 });

  const detailCacheRef = useRef<Map<string, LeadDetailState>>(new Map());
  const detailRequestsRef = useRef<Map<string, number>>(new Map());
  const detailRequestSeq = useRef(0);
  const selectedDetailSessionIdRef = useRef<string | null>(null);

  // Sync theme
  useEffect(() => {
    document.documentElement.dataset.adminTheme = theme;
    localStorage.setItem("tq-admin-theme", theme);
  }, [theme]);

  // Sync persistence
  useEffect(() => {
    localStorage.setItem("tq-admin-assignees", JSON.stringify(assignees));
  }, [assignees]);
  useEffect(() => {
    localStorage.setItem("tq-admin-display-timezone", displayTimezonePreference);
  }, [displayTimezonePreference]);
  useEffect(() => {
    localStorage.setItem("tq-admin-reporting-timezone", reportingTimezone);
  }, [reportingTimezone]);
  useEffect(() => {
    localStorage.setItem("tq-admin-active-page", activePage);
    document.title = `TechQuarters AI - ${PAGE_TITLES[activePage]}`;
  }, [activePage]);

  // Auto clear feedback toast
  useEffect(() => {
    if (!feedback || feedback === "Saving...") return;
    const timer = window.setTimeout(() => setFeedback(""), 3500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const displayTimezone =
    displayTimezonePreference === DISPLAY_TIMEZONE_BROWSER
      ? detectedTimezone
      : safeTimeZone(displayTimezonePreference, detectedTimezone);

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

  const handleAuthError = useCallback(
    async (loadError: unknown) => {
      console.error("[Dashboard Auth/Data Error]:", loadError);
      const status = (loadError as Error & { status?: number }).status;
      if (status === 401 || isInvalidRefreshTokenError(loadError)) {
        await handleExpiredAdminSession();
      } else if (status === 403) {
        await signOutLocally();
        navigate("/admin/login", { replace: true, state: { message: UNAUTHORIZED_MESSAGE } });
      } else {
        setError((loadError as Error).message || "Admin data could not be loaded.");
      }
    },
    [handleExpiredAdminSession, navigate]
  );

  const loadDashboard = useCallback(
    async (nextToken = token, showLoading = true) => {
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
          const sourceData = await adminFetch<unknown>(
            nextToken,
            `/api/admin/sources?${new URLSearchParams({ start, end, timeZone })}`
          );
          setSources(Array.isArray(sourceData) ? sourceData : []);
        } catch (sourceErr) {
          console.error("[Dashboard] /api/admin/sources fetch error:", sourceErr);
          setSources([]);
        }
      } catch (loadErr) {
        console.error("[Dashboard] /api/admin/dashboard fetch error:", loadErr);
        await handleAuthError(loadErr);
      } finally {
        setIsLoading(false);
      }
    },
    [customEndDate, customStartDate, handleAuthError, range, reportingTimezone, token]
  );

  const loadLeads = useCallback(
    async (nextToken = token) => {
      if (!nextToken) return;
      try {
        const params = new URLSearchParams({
          filter: activePage === "projects" ? "completed" : "active",
          timeZone: reportingTimezone,
        });
        const result = await adminFetch<any>(nextToken, `/api/admin/leads?${params}`);
        setLeads(result.rows || []);
        setLeadSummary({
          filteredCount: result.filteredCount || 0,
          totalLeadCount: result.totalLeadCount || 0,
          needingActionToday: result.needingActionToday || 0,
        });
      } catch (loadErr) {
        console.error("[Dashboard] /api/admin/leads fetch error:", loadErr);
        await handleAuthError(loadErr);
      }
    },
    [activePage, handleAuthError, reportingTimezone, token]
  );

  const loadConversations = useCallback(
    async (nextToken = token) => {
      if (!nextToken) return;
      try {
        const params = new URLSearchParams({
          score: scoreFilter,
          pageSize: conversationSize,
          archived: conversationArchiveView,
        });
        const result = await adminFetch<any>(nextToken, `/api/admin/conversations?${params}`);
        setConversations(result.rows || []);
        setConversationMeta({
          totalSessionCount: result.totalSessionCount || 0,
          filteredCount: result.filteredCount || 0,
        });
        setSelectedIds([]);
      } catch (loadErr) {
        console.error("[Dashboard] /api/admin/conversations fetch error:", loadErr);
        await handleAuthError(loadErr);
      }
    },
    [conversationArchiveView, conversationSize, handleAuthError, scoreFilter, token]
  );

  // Authenticate session on mount
  useEffect(() => {
    let isMounted = true;

    async function authenticate() {
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
        if (!accessToken) {
          navigate("/admin/login", { replace: true });
          return;
        }
        try {
          const settings = await adminFetch<any>(accessToken, "/api/admin/settings");
          if (settings.reporting_timezone && isMounted) {
            setReportingTimezone(safeTimeZone(settings.reporting_timezone));
          }
        } catch {
          // ignore
        }
        if (isMounted) setToken(accessToken);
      } catch {
        if (isMounted) navigate("/admin/login", { replace: true });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void authenticate();

    return () => {
      isMounted = false;
    };
  }, [handleExpiredAdminSession, navigate]);

  useEffect(() => {
    if (token) void loadDashboard(token, false);
  }, [loadDashboard, range, reportingTimezone, token]);

  useEffect(() => {
    if (token) void loadLeads(token);
  }, [activePage, loadLeads, token]);

  useEffect(() => {
    if (token) void loadConversations(token);
  }, [conversationArchiveView, conversationSize, loadConversations, scoreFilter, token]);

  // Detail Loader with Cache
  async function loadDetailInBackground(sessionId: string, requestId: number) {
    if (!token || detailRequestsRef.current.has(sessionId)) return;
    detailRequestsRef.current.set(sessionId, requestId);
    try {
      const loaded = await adminFetch<LeadDetailState>(
        token,
        `/api/admin/conversation-detail?id=${encodeURIComponent(sessionId)}`
      );
      const nextDetail = { ...loaded, isLoadingDetails: false, detailError: "" };
      detailCacheRef.current.set(sessionId, nextDetail);
      if (selectedDetailSessionIdRef.current === sessionId && detailRequestSeq.current === requestId) {
        setDetail(nextDetail);
      }
    } catch (loadErr) {
      if (selectedDetailSessionIdRef.current === sessionId && detailRequestSeq.current === requestId) {
        setDetail((curr) => (curr && curr.session.id === sessionId ? { ...curr, isLoadingDetails: false, detailError: "Lead details could not be loaded." } : curr));
      }
    } finally {
      if (detailRequestsRef.current.get(sessionId) === requestId) {
        detailRequestsRef.current.delete(sessionId);
      }
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

  async function updateLead(id: string, updates: Record<string, unknown>) {
    if (!token) return;
    setFeedback("Saving...");
    try {
      const saved = await adminFetch<LeadRow>(token, `/api/admin/leads?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      for (const [sessionId, cached] of detailCacheRef.current) {
        if (cached.lead?.id === id) {
          detailCacheRef.current.set(sessionId, {
            ...cached,
            lead: { ...cached.lead, ...saved },
            score: scoreBucket(saved.lead_score),
          });
        }
      }
      setFeedback("Changes saved.");
      await loadLeads();
      if (detail?.lead?.id === id) {
        setDetail({ ...detail, lead: { ...detail.lead, ...saved }, score: scoreBucket(saved.lead_score) });
      }
      if (projectDetail?.id === id) {
        setProjectDetail({ ...projectDetail, ...saved, score: scoreBucket(saved.lead_score) });
      }
    } catch (err) {
      setFeedback((err as Error).message);
      throw err;
    }
  }

  async function moveLeadToProjects(id: string, updates: Record<string, unknown>) {
    await updateLead(id, updates);
    await Promise.all([loadConversations(), loadLeads()]);
    setDetail(null);
    setActivePage("projects");
    setProjectView("ongoing");
    setFeedback("Lead converted to Projects Hub.");
  }

  async function archiveSelected(archived: boolean, ids = selectedIds) {
    if (!token || !ids.length) return;
    await adminFetch(token, "/api/admin/conversations", {
      method: "PATCH",
      body: JSON.stringify({ ids, archived }),
    });
    for (const id of ids) detailCacheRef.current.delete(id);
    await loadConversations();
    if (archivedOpen) await openArchivedData();
    setFeedback(archived ? "Lead archived." : "Lead restored.");
  }

  async function deleteSelected(ids = selectedIds) {
    if (!token || !ids.length) return;
    const ok = window.confirm("Permanent deletion cannot be undone. Delete selected lead record(s)?");
    if (!ok) return;
    try {
      await adminFetch(token, "/api/admin/conversations", {
        method: "DELETE",
        body: JSON.stringify({ ids, confirmProtected: true }),
      });
      for (const id of ids) detailCacheRef.current.delete(id);
      await loadConversations();
      setDetail(null);
      setProjectDetail(null);
      setFeedback("Record deleted.");
    } catch (deleteErr) {
      setFeedback((deleteErr as Error).message);
    }
  }

  async function openArchivedData() {
    if (!token) return;
    const result = await adminFetch<any>(
      token,
      `/api/admin/conversations?${new URLSearchParams({ score: "all", pageSize: "all", archived: "archived" })}`
    );
    setArchivedRows(result.rows || []);
    setArchivedSelected([]);
    setArchivedOpen(true);
  }

  async function exportCsv() {
    if (!token) return;
    const params = new URLSearchParams({ filter: "active", format: "csv" });
    const response = await fetch(`/api/admin/leads?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      setFeedback("CSV export failed.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `techquarters-leads-${todayKey()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function refreshActivePage() {
    if (!token || isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (activePage === "dashboard") await loadDashboard(token, false);
      else if (activePage === "pipeline") await loadConversations(token);
      else if (activePage === "projects") await loadLeads(token);
      setLastUpdated(new Date().toISOString());
      setFeedback("Dashboard refreshed.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    sessionStorage.setItem("tq-admin-logout", "1");
    navigate("/admin/login?logged_out=1", { replace: true, state: { loggedOut: true } });
  }

  // Computed data models
  const kpis = data?.kpis;
  const funnel = data?.funnel;
  const calendly = data?.calendly;
  const scores = data?.leadScores;

  const sourceMixItems: SourceMixItem[] = useMemo(() => {
    const colors = ["var(--chart-blue)", "var(--chart-teal)", "var(--chart-amber)", "var(--chart-green)", "var(--chart-violet)", "var(--chart-gray)"];
    return sources.map((s, idx) => ({
      label: String(s.source || "Direct / Referral"),
      value: Number(s.leads) || 0,
      color: colors[idx % colors.length],
      accent: "blue",
    })).filter((item) => item.value > 0);
  }, [sources]);

  const sourceMixTotal = useMemo(() => sourceMixItems.reduce((acc, curr) => acc + curr.value, 0), [sourceMixItems]);

  const activityTrend: TrendPoint[] = useMemo(() => {
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

  const manualBookedCount = useMemo(
    () => conversations.filter((r) => r.calendlyStatus === "Manually Marked Booked").length,
    [conversations]
  );

  return (
    <section className="admin-workspace">
      {/* Sidebar Navigation */}
      <DashboardSidebar
        activePage={activePage}
        setActivePage={setActivePage}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        theme={theme}
        setTheme={setTheme}
      />

      {/* Main Workspace Frame */}
      <div className="admin-main-shell">
        <DashboardHeader
          activePage={activePage}
          onRefresh={refreshActivePage}
          isRefreshing={isRefreshing}
          onOpenDrawer={() => setDrawerOpen(true)}
          lastUpdated={lastUpdated}
          displayTimezone={displayTimezone}
        />

        {/* Global Toast Notifications */}
        <div className="admin-toast-region" aria-live="polite">
          {feedback && <div className="admin-toast toast-success">{feedback}</div>}
          {error && <div className="admin-toast toast-error">{error}</div>}
        </div>

        {/* VIEW 1: COMMAND CENTER (ANALYTICS) */}
        {activePage === "dashboard" && (
          <div className="command-center-grid">
            {/* Top Control Bar */}
            <div className="command-header-panel">
              <div className="command-header-info">
                <h2>Operational Funnel Performance</h2>
                <p>Telemetry metrics across lead acquisition, engagement, and conversion flows.</p>
              </div>

              <div className="command-controls-group">
                <div className="date-range-select-wrap">
                  <select
                    value={range}
                    onChange={(e) => setRange(e.target.value as DashboardRange)}
                  >
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="week">This Week</option>
                    <option value="lastWeek">Last Week</option>
                    <option value="month">This Month</option>
                    <option value="lastMonth">Last Month</option>
                    <option value="quarter">This Quarter</option>
                    <option value="year">This Year</option>
                    <option value="allTime">All Time</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>

                {range === "custom" && (
                  <div className="custom-date-inputs">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                )}

                <span style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>
                  {rangeLabel(range, reportingTimezone, { startDate: customStartDate, endDate: customEndDate })}
                </span>
              </div>
            </div>

            {/* KPI Metric Cards */}
            <KpiCardGrid kpis={kpis} isLoading={isLoading} />

            {/* Charts Row 1 */}
            <div className="two-col-grid">
              <LeadActivityTrend
                points={activityTrend}
                rangeText={rangeLabel(range, reportingTimezone, { startDate: customStartDate, endDate: customEndDate })}
              />
              <SourceMixChart items={sourceMixItems} total={sourceMixTotal} />
            </div>

            {/* Charts Row 2 */}
            <div className="two-col-grid">
              <FunnelJourneyCard
                funnel={funnel}
                shown={kpis?.calendlyShown || 0}
                clicked={kpis?.calendlyClicked || 0}
                booked={kpis?.bookedCalls || 0}
                calendly={calendly}
              />
              <TodayActivityCard activity={data?.todayActivity} needingActionToday={leadSummary.needingActionToday} />
            </div>

            {/* Charts Row 3 */}
            <div className="two-col-grid">
              <IntentBreakdownCard scores={scores} />
              <BookingConversionChart
                shown={kpis?.calendlyShown || 0}
                clicked={kpis?.calendlyClicked || 0}
                booked={kpis?.bookedCalls || 0}
                manual={manualBookedCount}
              />
            </div>

            {/* Attribution Table */}
            <SourcesTable sources={sources} />
          </div>
        )}

        {/* VIEW 2: LEAD PIPELINE */}
        {activePage === "pipeline" && (
          <PipelineView
            conversations={conversations}
            conversationMeta={conversationMeta}
            scoreFilter={scoreFilter}
            setScoreFilter={setScoreFilter}
            conversationSize={conversationSize}
            setConversationSize={setConversationSize}
            conversationArchiveView={conversationArchiveView}
            setConversationArchiveView={setConversationArchiveView}
            selectMode={selectMode}
            setSelectMode={setSelectMode}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            onViewDetail={openDetail}
            onArchiveSelected={(archived) => archiveSelected(archived)}
            onDeleteSelected={() => deleteSelected()}
            onExportCsv={exportCsv}
            displayTimezone={displayTimezone}
          />
        )}

        {/* VIEW 3: PROJECTS DELIVERY HUB */}
        {activePage === "projects" && (
          <ProjectsView
            leads={leads}
            assignees={assignees}
            projectView={projectView}
            setProjectView={setProjectView}
            onUpdateLead={updateLead}
            onViewProject={setProjectDetail}
            displayTimezone={displayTimezone}
          />
        )}

        {/* VIEW 4: SETTINGS */}
        {activePage === "settings" && (
          <SettingsView
            theme={theme}
            setTheme={setTheme}
            assignees={assignees}
            setAssignees={setAssignees}
            newAssignee={newAssignee}
            setNewAssignee={setNewAssignee}
            conversationSize={conversationSize}
            setConversationSize={setConversationSize}
            scoreFilter={scoreFilter}
            setScoreFilter={setScoreFilter}
            displayTimezonePreference={displayTimezonePreference}
            setDisplayTimezonePreference={setDisplayTimezonePreference}
            reportingTimezone={reportingTimezone}
            setReportingTimezone={setReportingTimezone}
            browserTimezone={detectedTimezone}
            onSaveReportingTimezone={async () => {
              if (token) {
                await adminFetch(token, "/api/admin/settings", {
                  method: "PATCH",
                  body: JSON.stringify({ reporting_timezone: reportingTimezone }),
                });
              }
            }}
            onLoadAssigneeUsage={async (name: string) => {
              if (!token) throw new Error("Session required");
              return await adminFetch<AssigneeUsage>(token, `/api/admin/assignees?${new URLSearchParams({ name })}`);
            }}
            onDeleteAssignee={async (name: string, mode: AssigneeDeleteMode, replacementName?: string) => {
              if (!token) throw new Error("Session required");
              const result = await adminFetch<AssigneeUsage & { deleted: string }>(token, "/api/admin/assignees", {
                method: "PATCH",
                body: JSON.stringify({ name, mode, replacementName }),
              });
              setAssignees((items) => items.filter((i) => i !== name));
              await loadLeads();
              return result;
            }}
            onSaved={() => setFeedback("Preferences saved.")}
            onError={(msg) => setFeedback(msg)}
            onOpenArchived={openArchivedData}
            onLogout={logout}
          />
        )}
      </div>

      {/* Slide-in Lead Inspection Drawer */}
      {detail && (
        <LeadDetailDrawer
          key={detail.session.id}
          detail={detail}
          displayTimezone={displayTimezone}
          onClose={() => {
            selectedDetailSessionIdRef.current = null;
            setDetail(null);
          }}
          onUpdate={updateLead}
          onMoveToProjects={moveLeadToProjects}
          onArchive={() => void archiveSelected(true, [detail.session.id])}
          onDelete={() => void deleteSelected([detail.session.id])}
          onRetry={() => {
            const sid = detail.session.id;
            if (sid && token) {
              const reqId = ++detailRequestSeq.current;
              detailCacheRef.current.delete(sid);
              setDetail((c) => (c ? { ...c, isLoadingDetails: true, detailError: "" } : c));
              void loadDetailInBackground(sid, reqId);
            }
          }}
        />
      )}

      {/* Slide-in Project Inspection Drawer */}
      {projectDetail && (
        <ProjectDetailDrawer
          lead={projectDetail}
          assignees={assignees}
          onClose={() => setProjectDetail(null)}
          onUpdate={updateLead}
          onArchive={() => void updateLead(projectDetail.id, { archived_at: new Date().toISOString() })}
          onDelete={() => {
            if (window.confirm("Permanently remove this project lead record?")) {
              void updateLead(projectDetail.id, { archived_at: new Date().toISOString() });
            }
          }}
        />
      )}

      {/* Archived Data Management Modal */}
      {archivedOpen && (
        <ArchivedDataModal
          rows={archivedRows}
          selected={archivedSelected}
          setSelected={setArchivedSelected}
          onClose={() => setArchivedOpen(false)}
          onRestore={(ids) => void archiveSelected(false, ids)}
          onDelete={(ids) => void deleteSelected(ids)}
          displayTimezone={displayTimezone}
        />
      )}
    </section>
  );
}
