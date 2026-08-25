import { useState } from "react";
import Icon from "../../ui/Icon";
import {
  type LeadRow,
  type ScoreBucket,
  SCORE_OPTIONS,
  BOOKING_OPTIONS,
  PROJECT_STAGE_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  bookingDraftStatus,
  bookingUpdates,
  isValidEmail,
  normalizeTags,
  tagsFromInput,
  stageClass,
} from "../../../pages/dashboardService";

export default function ProjectDetailDrawer({
  lead,
  assignees,
  onClose,
  onUpdate,
  onArchive,
  onDelete,
}: {
  lead: LeadRow;
  assignees: string[];
  onClose: () => void;
  onUpdate: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onArchive: () => void;
  onDelete: () => void;
}) {
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
    if (!isValidEmail(draft.email)) {
      setFieldError("Enter a valid email address.");
      return;
    }
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inspector-drawer-overlay" role="dialog" aria-modal="true">
      <div className="inspector-drawer-sheet">
        <div className="drawer-header">
          <div className="drawer-header-info">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span className={`stage-pill ${stageClass(draft.project_stage)}`}>
                {draft.project_stage}
              </span>
              <span style={{ fontSize: "0.74rem", color: "var(--admin-text-muted)" }}>
                Contract: {draft.contract_status}
              </span>
            </div>
            <h2>{draft.project_name || draft.business_name || "Client Project"}</h2>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--admin-text-muted)" }}>
              {draft.name || "Primary contact"} • {draft.email || "No email"}
            </p>
          </div>

          <div className="drawer-header-actions">
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              disabled={saving}
              onClick={() => void saveProject()}
            >
              {saving ? "Saving..." : "Save Project"}
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

          {/* Project Configuration */}
          <article className="drawer-card accent-green">
            <div className="panel-header-row">
              <div>
                <span className="panel-eyebrow">DELIVERY & ASSIGNMENT</span>
                <h3 className="panel-title">Project Milestones</h3>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
              <div className="admin-input-group" style={{ gridColumn: "1 / -1" }}>
                <label>Project Name</label>
                <input
                  value={draft.project_name}
                  onChange={(e) => setDraft({ ...draft, project_name: e.target.value })}
                  placeholder="e.g. AI Customer Support System"
                />
              </div>

              <div className="admin-input-group">
                <label>Assignee</label>
                <select
                  value={draft.owner_name}
                  onChange={(e) => setDraft({ ...draft, owner_name: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {assignees.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

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
                <label>Target Delivery Date</label>
                <input
                  type="date"
                  value={draft.target_completion_date}
                  onChange={(e) => setDraft({ ...draft, target_completion_date: e.target.value })}
                />
              </div>

              <div className="admin-input-group" style={{ gridColumn: "1 / -1" }}>
                <label>Project Summary</label>
                <textarea
                  rows={3}
                  value={draft.project_summary}
                  onChange={(e) => setDraft({ ...draft, project_summary: e.target.value })}
                  placeholder="Summary of project goals and specifications..."
                />
              </div>

              <div className="admin-input-group" style={{ gridColumn: "1 / -1" }}>
                <label>Milestones & Deliverables</label>
                <textarea
                  rows={3}
                  value={draft.project_timeline}
                  onChange={(e) => setDraft({ ...draft, project_timeline: e.target.value })}
                  placeholder="Phase 1, Phase 2, Phase 3 milestones..."
                />
              </div>
            </div>
          </article>

          {/* Client & Contact Data */}
          <article className="drawer-card">
            <div className="panel-header-row">
              <div>
                <span className="panel-eyebrow">CLIENT DATA</span>
                <h3 className="panel-title">Contact & Classification</h3>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
              <div className="admin-input-group">
                <label>Contact Name</label>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="admin-input-group">
                <label>Contact Email</label>
                <input
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
              </div>
              <div className="admin-input-group">
                <label>Organization</label>
                <input
                  value={draft.business_name}
                  onChange={(e) => setDraft({ ...draft, business_name: e.target.value })}
                />
              </div>
              <div className="admin-input-group">
                <label>Phone</label>
                <input
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                />
              </div>
              <div className="admin-input-group">
                <label>Score</label>
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
            </div>
          </article>
        </div>

        <div className="drawer-footer">
          <div style={{ display: "flex", gap: "10px" }}>
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
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
