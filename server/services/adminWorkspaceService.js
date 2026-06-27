import { sendToN8n } from "./n8nService.js";
import { getSupabaseAdminClient } from "./supabaseAdminClient.js";
import { zonedDateKey } from "./timezoneService.js";

const SCORES = ["high", "medium", "low"];
const ACTIVE_STATUSES = ["new", "contacted", "in progress", "no response", "booked", "qualified", "nurture", "engaged"];
const PROTECTED_DELETE_STATUSES = new Set(["booked", "contacted", "in progress", "completed"]);
const LEAD_SELECT = [
  "id",
  "name",
  "email",
  "phone",
  "business_name",
  "website",
  "main_problem",
  "desired_outcome",
  "lead_score",
  "lead_status",
  "source",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "calendly_booked",
  "booked_at",
  "created_at",
  "updated_at",
  "workflow_status",
  "internal_notes",
  "owner_user_id",
  "owner_name",
  "follow_up_due_date",
  "tags",
  "archived_at",
  "completed_at",
  "booking_source",
  "booking_datetime",
  "booking_notes",
  "manually_booked",
  "project_name",
  "project_summary",
  "project_stage",
  "contract_status",
  "project_start_date",
  "target_completion_date",
  "project_timeline",
].join(", ");

const SESSION_SELECT = [
  "id",
  "lead_id",
  "session_status",
  "ai_summary",
  "pain_points",
  "recommended_next_action",
  "buying_intent",
  "last_message_at",
  "created_at",
  "updated_at",
  "archived_at",
  "deleted_at",
].join(", ");

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function scoreBucket(value) {
  const normalized = String(value || "").toLowerCase();
  return SCORES.includes(normalized) ? normalized : "unscored";
}

function workflowStatus(lead = {}, session = {}) {
  if (lead.completed_at) return "Completed";
  if (lead.archived_at || session.archived_at) return "Archived";
  return lead.workflow_status || lead.lead_status || session.session_status || "New";
}

function calendlyStatus(lead = {}, events = []) {
  if (lead.manually_booked) return "Manually Marked Booked";
  if (lead.calendly_booked || events.some((event) => event.event_type === "booking_completed")) return "Confirmed Booked";
  if (events.some((event) => event.event_type === "booking_clicked") || lead.booking_source === "Manual Admin Booking Clicked") return "Clicked";
  if (events.some((event) => event.event_type === "calendly_shown" || event.event_type === "booking_offered") || lead.booking_source === "Manual Admin Booking Offered") return "Shown";
  return "Not Shown";
}

function bookingSource(lead = {}) {
  if (lead.booking_source) return lead.booking_source;
  if (lead.calendly_booked) return "Calendly Confirmed";
  if (lead.manually_booked) return "Manual Admin Update";
  return "Unknown";
}

function compareLeadPriority(a, b) {
  const rank = { high: 0, medium: 1, low: 2, unscored: 3 };
  const scoreDiff = rank[scoreBucket(a.lead_score)] - rank[scoreBucket(b.lead_score)];
  if (scoreDiff) return scoreDiff;
  return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
}

function tagList(tags) {
  if (Array.isArray(tags)) return tags.map(String).filter(Boolean);
  if (typeof tags === "string" && tags.trim()) {
    try {
      const parsed = JSON.parse(tags);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [tags.trim()];
    } catch {
      return [tags.trim()];
    }
  }
  return [];
}

function searchText(lead) {
  return [
    lead.name,
    lead.email,
    lead.business_name,
    lead.website,
    lead.main_problem,
    lead.desired_outcome,
    lead.internal_notes,
    ...tagList(lead.tags),
  ].join(" ").toLowerCase();
}

async function queryAll(query, label) {
  const { data, error, count } = await query;
  if (error) {
    console.error(`${label} query failed:`, error);
    fail(`Failed to load ${label}`, 500);
  }
  return { data: data || [], count: count || 0 };
}

async function insertActivity({ leadId, sessionId = null, actor, eventType, eventData = {} }) {
  if (!leadId && !sessionId) return;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("lead_activity_log").insert({
    lead_id: leadId,
    session_id: sessionId,
    actor_user_id: actor?.user?.id || null,
    event_type: eventType,
    event_data: eventData,
  });
  if (error) console.warn("Activity log insert skipped:", error.message);
}

async function loadEventsForSessions(sessionIds) {
  if (!sessionIds.length) return new Map();
  const { data } = await queryAll(
    getSupabaseAdminClient()
      .from("funnel_events")
      .select("id, lead_id, session_id, event_type, event_data, created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: false }),
    "funnel events",
  );
  const bySession = new Map();
  for (const event of data) {
    const list = bySession.get(event.session_id) || [];
    list.push(event);
    bySession.set(event.session_id, list);
  }
  return bySession;
}

async function loadLeadsById(leadIds) {
  if (!leadIds.length) return new Map();
  const { data } = await queryAll(
    getSupabaseAdminClient().from("leads").select(LEAD_SELECT).in("id", leadIds),
    "leads",
  );
  return new Map(data.map((lead) => [lead.id, lead]));
}

export async function listConversations({ score = "scored", pageSize = 20, page = 1, archived = "active" }) {
  const supabase = getSupabaseAdminClient();
  const size = pageSize === "all" ? 1000 : Math.max(1, Math.min(Number(pageSize) || 20, 50));
  const from = pageSize === "all" ? 0 : (Math.max(1, Number(page) || 1) - 1) * size;

  let query = supabase
    .from("chat_sessions")
    .select(SESSION_SELECT, { count: "exact" })
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(5000);

  if (archived === "archived") query = query.not("archived_at", "is", null);
  else query = query.is("archived_at", null);

  const { data: sessions, count: totalSessionCount } = await queryAll(query, "chat sessions");
  const leadById = await loadLeadsById([...new Set(sessions.map((session) => session.lead_id).filter(Boolean))]);
  const eventsBySession = await loadEventsForSessions(sessions.map((session) => session.id));

  const rows = sessions
    .map((session) => {
      const lead = leadById.get(session.lead_id) || {};
      const events = eventsBySession.get(session.id) || [];
      return {
        id: session.id,
        leadId: session.lead_id,
        dateTime: session.last_message_at || session.created_at,
        displayName: lead.name || lead.business_name || "Anonymous visitor",
        businessName: lead.business_name || null,
        email: lead.email || null,
        score: scoreBucket(lead.lead_score),
        workflowStatus: workflowStatus(lead, session),
        mainProblem: lead.main_problem || session.pain_points || null,
        summary: session.ai_summary || "No session summary yet.",
        calendlyStatus: calendlyStatus(lead, events),
        bookingSource: bookingSource(lead),
        ownerName: lead.owner_name || "Unassigned",
        lastActivity: session.last_message_at || session.updated_at || lead.updated_at || session.created_at,
        archivedAt: session.archived_at,
        completedAt: lead.completed_at,
        lead,
      };
    })
    .filter((row) => {
      if (archived !== "archived" && row.completedAt) return false;
      if (score === "all") return true;
      if (score === "scored") return SCORES.includes(row.score);
      if (score === "unscored") return row.score === "unscored";
      return row.score === score;
    });

  const pagedRows = rows.slice(from, from + size);

  return {
    rows: pagedRows,
    totalSessionCount,
    filteredCount: rows.length,
    pageSize,
    page,
  };
}

export async function getConversationDetail(id) {
  if (!id) fail("Conversation id is required");
  const supabase = getSupabaseAdminClient();
  const { data: session } = await queryAll(
    supabase.from("chat_sessions").select(SESSION_SELECT).eq("id", id).limit(1),
    "chat session",
  );
  if (!session.length) fail("Conversation not found", 404);

  const leadById = await loadLeadsById(session[0].lead_id ? [session[0].lead_id] : []);
  const lead = leadById.get(session[0].lead_id) || {};
  const [{ data: messages }, { data: signals }, { data: events }, { data: activity }] = await Promise.all([
    queryAll(supabase.from("chat_messages").select("id, role, content, metadata, created_at").eq("session_id", id).order("created_at", { ascending: true }).limit(80), "chat messages"),
    session[0].lead_id ? queryAll(supabase.from("scoring_signals").select("*").eq("lead_id", session[0].lead_id).order("created_at", { ascending: false }).limit(20), "scoring signals") : { data: [] },
    queryAll(supabase.from("funnel_events").select("*").or(`session_id.eq.${id},lead_id.eq.${session[0].lead_id || "00000000-0000-0000-0000-000000000000"}`).order("created_at", { ascending: false }).limit(60), "funnel events"),
    session[0].lead_id ? queryAll(supabase.from("lead_activity_log").select("*").eq("lead_id", session[0].lead_id).order("created_at", { ascending: false }).limit(60), "activity log") : { data: [] },
  ]);

  return {
    session: session[0],
    lead,
    score: scoreBucket(lead.lead_score),
    workflowStatus: workflowStatus(lead, session[0]),
    calendlyStatus: calendlyStatus(lead, events),
    bookingSource: bookingSource(lead),
    messages,
    signals,
    funnelEvents: events,
    activity,
  };
}

export async function archiveConversations({ ids, archived }, actor) {
  const sessionIds = asArray(ids);
  if (!sessionIds.length) fail("At least one conversation id is required");
  const supabase = getSupabaseAdminClient();
  const value = archived ? new Date().toISOString() : null;
  const { data, error } = await supabase
    .from("chat_sessions")
    .update({ archived_at: value, updated_at: new Date().toISOString() })
    .in("id", sessionIds)
    .select("id, lead_id");
  if (error) fail("Conversation archive update failed", 500);
  await Promise.all((data || []).map((row) => insertActivity({
    leadId: row.lead_id,
    sessionId: row.id,
    actor,
    eventType: archived ? "conversation_archived" : "conversation_restored",
  })));
  return { updated: data?.length || 0 };
}

export async function deleteConversations({ ids, confirmProtected = false }, actor) {
  const sessionIds = asArray(ids);
  if (!sessionIds.length) fail("At least one conversation id is required");
  const supabase = getSupabaseAdminClient();
  const { data: sessions } = await queryAll(
    supabase.from("chat_sessions").select("id, lead_id").in("id", sessionIds),
    "chat sessions",
  );
  const leadById = await loadLeadsById([...new Set(sessions.map((session) => session.lead_id).filter(Boolean))]);
  const protectedRows = sessions.filter((session) => PROTECTED_DELETE_STATUSES.has(String(workflowStatus(leadById.get(session.lead_id), session)).toLowerCase()));
  if (protectedRows.length && !confirmProtected) {
    fail("Selected conversations include booked, contacted, in-progress, or completed leads. Extra confirmation is required.", 409);
  }

  await supabase.from("chat_messages").delete().in("session_id", sessionIds);
  await supabase.from("funnel_events").delete().in("session_id", sessionIds);
  const { error } = await supabase.from("chat_sessions").delete().in("id", sessionIds);
  if (error) fail("Conversation deletion failed", 500);
  await Promise.all(sessions.map((row) => insertActivity({
    leadId: row.lead_id,
    sessionId: row.id,
    actor,
    eventType: "conversation_deleted",
    eventData: { permanent: true },
  })));
  return { deleted: sessions.length, protectedCount: protectedRows.length };
}

export async function listLeadPipeline({ filter = "active", search = "", tag = "", exportAll = false, timeZone } = {}) {
  const supabase = getSupabaseAdminClient();
  const { data: leads } = await queryAll(
    supabase.from("leads").select(LEAD_SELECT).order("created_at", { ascending: false }).limit(exportAll ? 5000 : 1000),
    "lead pipeline",
  );
  const needle = String(search || "").trim().toLowerCase();
  const wantedTag = String(tag || "").trim().toLowerCase();
  const todayKey = zonedDateKey(timeZone);

  const rows = leads
    .filter((lead) => {
      const status = String(workflowStatus(lead)).toLowerCase();
      const score = scoreBucket(lead.lead_score);
      const due = lead.follow_up_due_date;
      if (filter === "completed") return Boolean(lead.completed_at) || status === "completed";
      if (filter === "archived") return Boolean(lead.archived_at) || status === "archived";
      if (filter === "high" || filter === "medium" || filter === "low") return score === filter && !lead.archived_at && !lead.completed_at;
      if (filter === "due_today") return due === todayKey && !lead.archived_at && !lead.completed_at;
      if (filter === "overdue") return due && due < todayKey && !lead.archived_at && !lead.completed_at;
      if (filter === "no_due_date") return !due && !lead.archived_at && !lead.completed_at;
      if (filter === "disqualified") return status === "disqualified";
      if (["new", "contacted", "in progress", "no response", "booked"].includes(filter)) return status === filter && !lead.archived_at && !lead.completed_at;
      return ACTIVE_STATUSES.includes(status) && !lead.archived_at && !lead.completed_at;
    })
    .filter((lead) => !needle || searchText(lead).includes(needle))
    .filter((lead) => !wantedTag || tagList(lead.tags).some((item) => item.toLowerCase().includes(wantedTag)))
    .sort(compareLeadPriority)
    .map((lead) => ({
      ...lead,
      score: scoreBucket(lead.lead_score),
      workflowStatus: workflowStatus(lead),
      calendlyStatus: calendlyStatus(lead),
      bookingSource: bookingSource(lead),
      tags: tagList(lead.tags),
    }));

  return {
    rows,
    totalLeadCount: leads.length,
    filteredCount: rows.length,
    needingActionToday: rows.filter((lead) => lead.follow_up_due_date && lead.follow_up_due_date <= todayKey && !lead.completed_at && !lead.archived_at).length,
  };
}

export async function updateLead(id, updates, actor) {
  if (!id) fail("Lead id is required");
  const allowed = new Set([
    "name",
    "email",
    "phone",
    "business_name",
    "workflow_status",
    "internal_notes",
    "owner_user_id",
    "owner_name",
    "follow_up_due_date",
    "tags",
    "archived_at",
    "completed_at",
    "booking_source",
    "booking_datetime",
    "booking_notes",
    "manually_booked",
    "calendly_booked",
    "booked_at",
    "project_name",
    "project_summary",
    "project_stage",
    "contract_status",
    "project_start_date",
    "target_completion_date",
    "project_timeline",
  ]);
  const clean = {};
  for (const [key, value] of Object.entries(updates || {})) {
    if (allowed.has(key)) clean[key] = key === "tags" ? tagList(value) : value || null;
  }
  if (!Object.keys(clean).length) fail("No supported fields were provided");
  clean.updated_at = new Date().toISOString();

  if (clean.workflow_status === "Completed" && !clean.completed_at) clean.completed_at = new Date().toISOString();
  if (clean.manually_booked === true) {
    clean.calendly_booked = false;
    clean.booked_at = clean.booking_datetime || new Date().toISOString();
    clean.booking_source = clean.booking_source || "Manual Admin Update";
    clean.workflow_status = clean.workflow_status || "Booked";
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("leads").update(clean).eq("id", id).select(LEAD_SELECT).maybeSingle();
  if (error) fail("Lead update failed", 500);
  await insertActivity({ leadId: id, actor, eventType: "lead_updated", eventData: clean });

  if (updates?.manually_booked === true) {
    await insertActivity({ leadId: id, actor, eventType: "manual_booking_confirmed", eventData: clean });
    await sendToN8n({
      event_type: "manual_booking_confirmed",
      lead_id: id,
      booking_source: clean.booking_source,
      booking_timestamp: clean.booking_datetime || clean.booked_at,
      suppress_followups: true,
    }).catch((error) => console.warn("Manual booking n8n event skipped:", error.message));
  }

  return data;
}

export async function sourceBreakdown({ start, end }) {
  const supabase = getSupabaseAdminClient();
  const { data: leads } = await queryAll(
    supabase.from("leads").select(LEAD_SELECT).gte("created_at", start).lt("created_at", end).limit(5000),
    "source leads",
  );
  const { data: events } = await queryAll(
    supabase.from("funnel_events").select("lead_id, event_type, created_at").gte("created_at", start).lt("created_at", end).limit(5000),
    "source events",
  );
  const byLead = new Map();
  for (const event of events) {
    const list = byLead.get(event.lead_id) || [];
    list.push(event.event_type);
    byLead.set(event.lead_id, list);
  }
  const groups = new Map();
  for (const lead of leads) {
    const key = lead.utm_campaign || lead.utm_source || lead.source || "Unknown";
    if (key === "Unknown") continue;
    const group = groups.get(key) || {
      source: key,
      leads: 0,
      high: 0,
      medium: 0,
      low: 0,
      calendlyShown: 0,
      clicked: 0,
      confirmedBooked: 0,
    };
    const eventsForLead = byLead.get(lead.id) || [];
    group.leads += 1;
    group[scoreBucket(lead.lead_score)] = (group[scoreBucket(lead.lead_score)] || 0) + 1;
    if (eventsForLead.includes("calendly_shown") || eventsForLead.includes("booking_offered")) group.calendlyShown += 1;
    if (eventsForLead.includes("booking_clicked")) group.clicked += 1;
    if (lead.calendly_booked || eventsForLead.includes("booking_completed")) group.confirmedBooked += 1;
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    qualifiedRate: group.leads ? Math.round(((group.high + group.medium) / group.leads) * 1000) / 10 : 0,
    bookedRate: group.leads ? Math.round((group.confirmedBooked / group.leads) * 1000) / 10 : 0,
  }));
}

export function leadsToCsv(rows) {
  const headers = ["Name", "Email", "Business Name", "Score", "Workflow Status", "Owner", "Main Problem", "Desired Outcome", "Calendly Status", "Booking Source", "Follow-up Due Date", "Last Activity", "Created Date", "Tags", "Notes"];
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((lead) => [
    lead.name,
    lead.email,
    lead.business_name,
    lead.score,
    lead.workflowStatus,
    lead.owner_name,
    lead.main_problem,
    lead.desired_outcome,
    lead.calendlyStatus,
    lead.bookingSource,
    lead.follow_up_due_date,
    lead.updated_at,
    lead.created_at,
    tagList(lead.tags).join("; "),
    lead.internal_notes,
  ].map(escape).join(","));
  return [headers.map(escape).join(","), ...lines].join("\n");
}





export async function getAdminSettings() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_settings")
    .select("key, value")
    .in("key", ["reporting_timezone"]);
  if (error) {
    console.warn("Admin settings unavailable, using client defaults:", error.message);
    return {};
  }
  return Object.fromEntries((data || []).map((row) => [row.key, row.value]));
}

export async function updateAdminSettings(settings) {
  const supabase = getSupabaseAdminClient();
  const rows = [];
  if (settings.reporting_timezone) {
    rows.push({ key: "reporting_timezone", value: String(settings.reporting_timezone), updated_at: new Date().toISOString() });
  }
  if (!rows.length) return await getAdminSettings();
  const { error } = await supabase.from("admin_settings").upsert(rows, { onConflict: "key" });
  if (error) fail("Admin settings update failed", 500);
  return await getAdminSettings();
}


function isProjectRow(row) {
  return Boolean(row?.completed_at) || String(row?.workflow_status || "").toLowerCase() === "completed";
}

async function assigneeProjectRows(assignee) {
  const supabase = getSupabaseAdminClient();
  const { data: rows } = await queryAll(
    supabase
      .from("leads")
      .select("id, completed_at, workflow_status, project_name, project_stage, owner_name, archived_at")
      .eq("owner_name", assignee)
      .is("archived_at", null)
      .limit(5000),
    "assignee project usage",
  );
  return rows.filter(isProjectRow);
}

export async function assigneeUsage(name) {
  const assignee = String(name || "").trim();
  if (!assignee) fail("Assignee name is required");
  const projectRows = await assigneeProjectRows(assignee);
  return { assignee, projectCount: projectRows.length, affectedCount: projectRows.length };
}

export async function deleteAssignee({ name, replacementName = null, mode }, actor) {
  const assignee = String(name || "").trim();
  if (!assignee) fail("Assignee name is required");
  const replacement = replacementName ? String(replacementName).trim() : null;
  const projectRows = await assigneeProjectRows(assignee);
  const usage = { assignee, projectCount: projectRows.length, affectedCount: projectRows.length };
  if (usage.affectedCount > 0 && mode !== "reassign" && mode !== "unassign") {
    fail("Choose a replacement assignee or set affected projects to Unassigned.");
  }
  if (mode === "reassign" && !replacement) fail("Replacement assignee is required");
  if (replacement && replacement === assignee) fail("Replacement assignee must be different");

  if (usage.affectedCount > 0) {
    const supabase = getSupabaseAdminClient();
    const nextOwner = mode === "reassign" ? replacement : null;
    const ids = projectRows.map((project) => project.id);
    const { data, error } = await supabase
      .from("leads")
      .update({ owner_name: nextOwner, updated_at: new Date().toISOString() })
      .in("id", ids)
      .select("id");
    if (error) fail("Project reassignment failed", 500);
    await Promise.all((data || []).map((project) => insertActivity({
      leadId: project.id,
      actor,
      eventType: "assignee_deleted",
      eventData: { previous_assignee: assignee, replacement_assignee: nextOwner, mode, scope: "projects" },
    })));
  }

  return { ...usage, deleted: assignee, replacementName: mode === "reassign" ? replacement : null, mode: usage.affectedCount ? mode : "unused" };
}
