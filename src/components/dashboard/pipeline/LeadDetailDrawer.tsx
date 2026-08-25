import { useState } from "react";
import Icon from "../../ui/Icon";
import ScoreBadge from "../common/ScoreBadge";
import {
  type LeadDetailState,
  type ScoreBucket,
  SCORE_OPTIONS,
  BOOKING_OPTIONS,
  PROJECT_STAGE_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  bookingDetailStatus,
  bookingDraftStatus,
  bookingUpdates,
  dateTime,
  isValidEmail,
  normalizeTags,
  tagsFromInput,
} from "../../../pages/dashboardService";

export default function LeadDetailDrawer({
  detail,
  displayTimezone,
  onClose,
  onUpdate,
  onMoveToProjects,
  onArchive,
  onDelete,
  onRetry,
}: {
  detail: LeadDetailState;
  displayTimezone: string;
  onClose: () => void;
  onUpdate: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onMoveToProjects: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onArchive: () => void;
  onDelete: () => void;
  onRetry: () => void;
}) {
  const lead = detail.lead || {};
  const isAlreadyProject = Boolean(lead.completed_at) || detail.workflowStatus === "Completed";
  const detailsLoading = Boolean(detail.isLoadingDetails);
  const detailError = detail.detailError || "";

  const [activeTab, setActiveTab] = useState<"overview" | "chat" | "project">("overview");

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
    if (!isValidEmail(draft.email)) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setFieldError("");
    setSaving(true);
    try {
      await onUpdate(lead.id, buildUpdates());
    } finally {
      setSaving(false);
    }
  }

  async function moveToProjects() {
    if (isAlreadyProject || saving) return;
    if (!isValidEmail(draft.email)) {
      setFieldError("Enter a valid email address.");
      return;
    }
    const ok = window.confirm(
      "Convert this qualified lead to Projects? It will transition into your Projects Delivery Hub while preserving all chat history, scoring, notes, and contact details."
    );
    if (!ok) return;
    setFieldError("");
    setSaving(true);
    try {
      await onMoveToProjects(
        lead.id,
        buildUpdates({
          workflow_status: "Completed",
          completed_at: new Date().toISOString(),
          project_stage: draft.project_stage || "Not Started",
        })
      );
    } finally {
      setSaving(false);
    }
  }

  const latestSignal = Array.isArray(detail.signals) && detail.signals.length ? detail.signals[0] : null;

  return (
    <div className="inspector-drawer-overlay" role="dialog" aria-modal="true">
      <div className="inspector-drawer-sheet">
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-header-info">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <ScoreBadge score={draft.lead_score} />
              <span
                style={{
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  color: "var(--admin-text-muted)",
                }}
              >
                {bookingDetailStatus(draft.booking_status)}
              </span>
            </div>
            <h2>{draft.name || draft.business_name || "Anonymous Visitor"}</h2>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--admin-text-muted)" }}>
              {draft.email || "No email stored"}
            </p>
          </div>

          <div className="drawer-header-actions">
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              disabled={saving}
              onClick={() => void saveDetail()}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              className="drawer-close-circle-btn"
              onClick={onClose}
              title="Close drawer"
              aria-label="Close drawer"
            >
              <Icon name="close" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="drawer-tabs-bar">
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview & Contact
          </button>
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            Chat Transcript ({detail.messages?.length || 0})
          </button>
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === "project" ? "active" : ""}`}
            onClick={() => setActiveTab("project")}
          >
            Project Setup
          </button>
        </div>

        {/* Drawer Body Scroll */}
        <div className="drawer-body-scroll">
          {fieldError && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--admin-radius-md)",
                background: "rgba(244, 63, 94, 0.15)",
                border: "1px solid var(--chart-rose)",
                color: "var(--chart-rose)",
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              {fieldError}
            </div>
          )}

          {detailError && (
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(245, 158, 11, 0.15)",
                border: "1px solid var(--chart-amber)",
                borderRadius: "var(--admin-radius-md)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: "0.82rem", color: "var(--chart-amber)" }}>
                {detailError}
              </span>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={onRetry}
                style={{ padding: "4px 10px", fontSize: "0.75rem" }}
              >
                Retry
              </button>
            </div>
          )}

          {/* TAB 1: OVERVIEW & CONTACT */}
          {activeTab === "overview" && (
            <>
              <div className="drawer-identity-strip">
                <div className="drawer-identity-item">
                  <span className="drawer-identity-label">Name</span>
                  <strong className="drawer-identity-val">{draft.name || "Anonymous"}</strong>
                </div>
                <div className="drawer-identity-item">
                  <span className="drawer-identity-label">Business</span>
                  <strong className="drawer-identity-val">{draft.business_name || "Not captured"}</strong>
                </div>
                <div className="drawer-identity-item">
                  <span className="drawer-identity-label">Status</span>
                  <strong className="drawer-identity-val">{detail.workflowStatus || "Active"}</strong>
                </div>
                <div className="drawer-identity-item">
                  <span className="drawer-identity-label">Booking</span>
                  <strong className="drawer-identity-val">{bookingDetailStatus(draft.booking_status)}</strong>
                </div>
              </div>

              {/* AI Qualification Breakdown */}
              <article className="drawer-card accent-amber">
                <div className="panel-header-row">
                  <div>
                    <span className="panel-eyebrow">AI QUALIFICATION SIGNALS</span>
                    <h3 className="panel-title">Scoring Evaluation</h3>
                  </div>
                </div>

                {latestSignal ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginTop: "8px" }}>
                    <div style={{ padding: "10px", background: "var(--admin-panel-2)", borderRadius: "var(--admin-radius-sm)" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--admin-text-muted)", display: "block" }}>
                        Has Established Business
                      </span>
                      <strong style={{ fontSize: "0.88rem" }}>{latestSignal.has_business ? "Yes" : "No"}</strong>
                    </div>
                    <div style={{ padding: "10px", background: "var(--admin-panel-2)", borderRadius: "var(--admin-radius-sm)" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--admin-text-muted)", display: "block" }}>
                        Has Traffic or Ad Spend
                      </span>
                      <strong style={{ fontSize: "0.88rem" }}>{latestSignal.has_traffic_or_spend ? "Yes" : "No"}</strong>
                    </div>
                    <div style={{ padding: "10px", background: "var(--admin-panel-2)", borderRadius: "var(--admin-radius-sm)" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--admin-text-muted)", display: "block" }}>
                        Problem Clarity
                      </span>
                      <strong style={{ fontSize: "0.88rem" }}>
                        {latestSignal.problem_clarity ? `Score: ${latestSignal.problem_clarity}/10` : "Not evaluated"}
                      </strong>
                    </div>
                    <div style={{ padding: "10px", background: "var(--admin-panel-2)", borderRadius: "var(--admin-radius-sm)" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--admin-text-muted)", display: "block" }}>
                        Implementation Urgency
                      </span>
                      <strong style={{ fontSize: "0.88rem" }}>
                        {latestSignal.urgency ? `Score: ${latestSignal.urgency}/10` : "Not evaluated"}
                      </strong>
                    </div>
                    {latestSignal.score_reason && (
                      <div style={{ gridColumn: "1 / -1", padding: "10px", background: "var(--admin-panel-2)", borderRadius: "var(--admin-radius-sm)" }}>
                        <span style={{ fontSize: "0.7rem", color: "var(--admin-text-muted)", display: "block" }}>
                          Scoring Rationale
                        </span>
                        <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--admin-text-main)", lineHeight: 1.4 }}>
                          {latestSignal.score_reason}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="kpi-caption" style={{ margin: "10px 0" }}>
                    No qualification signals logged for this session.
                  </p>
                )}
              </article>

              {/* Contact Information Form */}
              <article className="drawer-card">
                <div className="panel-header-row">
                  <div>
                    <span className="panel-eyebrow">LEAD PROFILE</span>
                    <h3 className="panel-title">Contact & Classification</h3>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
                  <div className="admin-input-group">
                    <label>Full Name</label>
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      placeholder="e.g. Sarah Jenkins"
                    />
                  </div>
                  <div className="admin-input-group">
                    <label>Email Address</label>
                    <input
                      value={draft.email}
                      onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                      placeholder="sarah@example.com"
                    />
                  </div>
                  <div className="admin-input-group">
                    <label>Business Name</label>
                    <input
                      value={draft.business_name}
                      onChange={(e) => setDraft({ ...draft, business_name: e.target.value })}
                      placeholder="Acme Corp"
                    />
                  </div>
                  <div className="admin-input-group">
                    <label>Phone Number</label>
                    <input
                      value={draft.phone}
                      onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div className="admin-input-group">
                    <label>Intent Score</label>
                    <select
                      value={draft.lead_score}
                      onChange={(e) => setDraft({ ...draft, lead_score: e.target.value as ScoreBucket })}
                    >
                      {SCORE_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s === "unscored" ? "Unscored" : s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-input-group">
                    <label>Booking Status</label>
                    <select
                      value={draft.booking_status}
                      onChange={(e) => setDraft({ ...draft, booking_status: e.target.value })}
                    >
                      {BOOKING_OPTIONS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-input-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Tags (comma separated)</label>
                    <input
                      value={draft.tags}
                      onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                      placeholder="urgent, healthcare, enterprise"
                    />
                  </div>
                </div>
              </article>

              {/* Internal Notes */}
              <article className="drawer-card">
                <div className="panel-header-row">
                  <div>
                    <span className="panel-eyebrow">COLLABORATION</span>
                    <h3 className="panel-title">Internal Notes</h3>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div className="admin-input-group">
                    <label>Team Admin Notes</label>
                    <textarea
                      rows={4}
                      value={draft.internal_notes}
                      onChange={(e) => setDraft({ ...draft, internal_notes: e.target.value })}
                      placeholder="Notes on client requirements..."
                    />
                  </div>
                  <div className="admin-input-group">
                    <label>Booking Call Notes</label>
                    <textarea
                      rows={4}
                      value={draft.booking_notes}
                      onChange={(e) => setDraft({ ...draft, booking_notes: e.target.value })}
                      placeholder="Strategy call outcome..."
                    />
                  </div>
                </div>
              </article>
            </>
          )}

          {/* TAB 2: CHAT TRANSCRIPT PLAYBACK */}
          {activeTab === "chat" && (
            <article className="drawer-card accent-blue">
              <div className="panel-header-row">
                <div>
                  <span className="panel-eyebrow">LIVE CONVERSATION RECORD</span>
                  <h3 className="panel-title">Chat Messages & Bot Responses</h3>
                </div>
                <span className="panel-badge">{detail.messages?.length || 0} Messages</span>
              </div>

              {detailsLoading ? (
                <p className="kpi-caption" style={{ padding: "40px 0", textAlign: "center" }}>
                  Loading chat transcript...
                </p>
              ) : detail.messages && detail.messages.length > 0 ? (
                <div className="transcript-flow-list">
                  {detail.messages.map((msg, idx) => {
                    const isUser = msg.role === "user";
                    return (
                      <div
                        key={msg.id || idx}
                        className={`transcript-bubble ${isUser ? "user-bubble" : "assistant-bubble"}`}
                      >
                        <div className="bubble-header">
                          <span className="bubble-sender">
                            {isUser ? "Visitor" : "TechQuarters Assistant"}
                          </span>
                          <span className="bubble-time-tag">
                            {dateTime(msg.created_at || msg.inserted_at, displayTimezone)}
                          </span>
                        </div>
                        <div className="bubble-content">{msg.content}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="kpi-caption" style={{ padding: "40px 0", textAlign: "center" }}>
                  No messages stored for this session.
                </p>
              )}
            </article>
          )}

          {/* TAB 3: PROJECT DELIVERY SETUP */}
          {activeTab === "project" && (
            <article className="drawer-card accent-green">
              <div className="panel-header-row">
                <div>
                  <span className="panel-eyebrow">DELIVERY CONFIGURATION</span>
                  <h3 className="panel-title">Project Milestones & Tracking</h3>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div className="admin-input-group">
                  <label>Project Title</label>
                  <input
                    value={draft.project_name}
                    onChange={(e) => setDraft({ ...draft, project_name: e.target.value })}
                    placeholder="e.g. Custom Customer Support AI Agent"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
                  <div className="admin-input-group">
                    <label>Project Stage</label>
                    <select
                      value={draft.project_stage}
                      onChange={(e) => setDraft({ ...draft, project_stage: e.target.value as any })}
                    >
                      {PROJECT_STAGE_OPTIONS.map((stg) => (
                        <option key={stg} value={stg}>
                          {stg}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-input-group">
                    <label>Contract Status</label>
                    <select
                      value={draft.contract_status}
                      onChange={(e) => setDraft({ ...draft, contract_status: e.target.value as any })}
                    >
                      {CONTRACT_STATUS_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-input-group">
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={draft.project_start_date}
                      onChange={(e) => setDraft({ ...draft, project_start_date: e.target.value })}
                    />
                  </div>
                  <div className="admin-input-group">
                    <label>Target Completion Date</label>
                    <input
                      type="date"
                      value={draft.target_completion_date}
                      onChange={(e) => setDraft({ ...draft, target_completion_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="admin-input-group">
                  <label>Project Summary</label>
                  <textarea
                    rows={3}
                    value={draft.project_summary}
                    onChange={(e) => setDraft({ ...draft, project_summary: e.target.value })}
                    placeholder="Key deliverables and business goals..."
                  />
                </div>

                <div className="admin-input-group">
                  <label>Timeline & Milestones</label>
                  <textarea
                    rows={3}
                    value={draft.project_timeline}
                    onChange={(e) => setDraft({ ...draft, project_timeline: e.target.value })}
                    placeholder="Phase 1: Discovery, Phase 2: Bot Training, Phase 3: Integration..."
                  />
                </div>
              </div>
            </article>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="drawer-footer">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            disabled={isAlreadyProject || saving}
            onClick={() => void moveToProjects()}
            title={isAlreadyProject ? "Lead already active in Projects" : "Convert lead into Projects Hub"}
          >
            <Icon name="calendar" />
            <span>{isAlreadyProject ? "Already In Projects" : "Move To Projects"}</span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={onArchive}
            >
              <Icon name="archive" />
              <span>Archive</span>
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-danger"
              onClick={onDelete}
            >
              <Icon name="trash" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
