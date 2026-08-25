import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../ui/Icon";
import {
  TIMEZONE_OPTIONS,
  DISPLAY_TIMEZONE_BROWSER,
  safeTimeZone,
} from "../../../lib/timezone";
import type {
  AssigneeUsage,
  AssigneeDeleteMode,
} from "../../../pages/dashboardService";

export default function SettingsView({
  theme,
  setTheme,
  assignees,
  setAssignees,
  newAssignee,
  setNewAssignee,
  conversationSize,
  setConversationSize,
  scoreFilter,
  setScoreFilter,
  displayTimezonePreference,
  setDisplayTimezonePreference,
  reportingTimezone,
  setReportingTimezone,
  browserTimezone,
  onSaveReportingTimezone,
  onLoadAssigneeUsage,
  onDeleteAssignee,
  onSaved,
  onError,
  onOpenArchived,
  onLogout,
}: {
  theme: string;
  setTheme: (value: string) => void;
  assignees: string[];
  setAssignees: (value: string[]) => void;
  newAssignee: string;
  setNewAssignee: (value: string) => void;
  conversationSize: string;
  setConversationSize: (value: string) => void;
  scoreFilter: string;
  setScoreFilter: (value: string) => void;
  displayTimezonePreference: string;
  setDisplayTimezonePreference: (value: string) => void;
  reportingTimezone: string;
  setReportingTimezone: (value: string) => void;
  browserTimezone: string;
  onSaveReportingTimezone: () => Promise<void>;
  onLoadAssigneeUsage: (name: string) => Promise<AssigneeUsage>;
  onDeleteAssignee: (name: string, mode: AssigneeDeleteMode, replacementName?: string) => Promise<unknown>;
  onSaved: () => void;
  onError: (message: string) => void;
  onOpenArchived: () => void;
  onLogout: () => Promise<void>;
}) {
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
    } finally {
      window.setTimeout(() => setSaving(false), 250);
    }
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
    try {
      await onDeleteAssignee(pendingDelete.assignee, deleteMode, replacementName || undefined);
      setPendingDelete(null);
      setDeleteError("");
      onSaved();
    } catch (error) {
      const message = (error as Error).message || "Assignee could not be deleted.";
      setDeleteError(message);
      onError(message);
    } finally {
      setDeleteBusy(false);
    }
  }

  const replacementOptions = assignees.filter((name) => name !== pendingDelete?.assignee);
  const canDelete = Boolean(
    pendingDelete &&
      (pendingDelete.affectedCount === 0 ||
        deleteMode === "unassign" ||
        (deleteMode === "reassign" && replacementName))
  );

  return (
    <div className="settings-grid">
      {/* Workspace Controls */}
      <article className="admin-card accent-teal">
        <div className="panel-header-row">
          <div>
            <span className="panel-eyebrow">WORKSPACE & AUTHENTICATION</span>
            <h3 className="panel-title">Session & System Access</h3>
          </div>
        </div>
        <p className="kpi-caption" style={{ margin: "0 0 16px" }}>
          Manage your active admin session and navigate between public and administrative views.
        </p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link className="admin-btn admin-btn-secondary" to="/">
            <Icon name="external" />
            <span>View Public Website</span>
          </Link>
          <button
            type="button"
            className="admin-btn admin-btn-danger"
            onClick={() => void onLogout()}
          >
            <Icon name="close" />
            <span>Sign Out Securely</span>
          </button>
        </div>
      </article>

      {/* Regional & UI Preferences */}
      <article className="admin-card accent-blue">
        <div className="panel-header-row">
          <div>
            <span className="panel-eyebrow">LOCALIZATION & UI PREFERENCES</span>
            <h3 className="panel-title">Timezone & Display Options</h3>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
          <div className="admin-input-group">
            <label>Interface Theme</label>
            <select
              value={theme}
              onChange={(e) => {
                markDirty();
                setTheme(e.target.value);
              }}
            >
              <option value="dark">Dark Theme</option>
              <option value="light">Light Theme</option>
            </select>
          </div>

          <div className="admin-input-group">
            <label>Default Pipeline Page Size</label>
            <select
              value={conversationSize}
              onChange={(e) => {
                markDirty();
                setConversationSize(e.target.value);
              }}
            >
              <option value="10">10 Rows</option>
              <option value="20">20 Rows</option>
              <option value="50">50 Rows</option>
              <option value="all">Show All</option>
            </select>
          </div>

          <div className="admin-input-group">
            <label>Default Intent Filter</label>
            <select
              value={scoreFilter}
              onChange={(e) => {
                markDirty();
                setScoreFilter(e.target.value);
              }}
            >
              <option value="scored">Scored Sessions</option>
              <option value="all">All Sessions</option>
              <option value="high">High Intent Only</option>
            </select>
          </div>

          <div className="admin-input-group">
            <label>Interface Display Timezone</label>
            <select
              value={displayTimezonePreference}
              onChange={(e) => {
                markDirty();
                setDisplayTimezonePreference(e.target.value);
              }}
            >
              <option value={DISPLAY_TIMEZONE_BROWSER}>
                Browser Timezone ({browserTimezone})
              </option>
              {TIMEZONE_OPTIONS.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-input-group" style={{ gridColumn: "1 / -1" }}>
            <label>Reporting Aggregation Timezone</label>
            <select
              value={reportingTimezone}
              onChange={(e) => {
                markDirty();
                setReportingTimezone(safeTimeZone(e.target.value));
              }}
            >
              {TIMEZONE_OPTIONS.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </div>
        </div>
      </article>

      {/* Team / Assignees */}
      <article className="admin-card accent-violet">
        <div className="panel-header-row">
          <div>
            <span className="panel-eyebrow">TEAM COLLABORATION</span>
            <h3 className="panel-title">Project Assignees</h3>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {assignees.map((name, index) => (
            <div
              key={name + "-" + index}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "var(--admin-panel-2)",
                padding: "6px 10px",
                borderRadius: "var(--admin-radius-sm)",
                border: "1px solid var(--admin-border)",
              }}
            >
              <Icon name="user" style={{ width: "16px", height: "16px", color: "var(--chart-violet)" }} />
              <input
                value={name}
                onChange={(e) => {
                  markDirty();
                  setAssignees(
                    assignees.map((item, itemIndex) => (itemIndex === index ? e.target.value : item))
                  );
                }}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: 0,
                  color: "var(--admin-text-main)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  outline: "none",
                }}
              />
              <button
                type="button"
                className="icon-action-btn"
                onClick={() => void beginDeleteAssignee(name)}
                title={`Remove ${name}`}
                style={{ width: "28px", height: "28px" }}
              >
                <Icon name="trash" />
              </button>
            </div>
          ))}

          <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
            <input
              placeholder="Add new team assignee..."
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
              style={{
                flex: 1,
                background: "var(--admin-panel-2)",
                border: "1px solid var(--admin-border)",
                borderRadius: "var(--admin-radius-sm)",
                padding: "8px 12px",
                color: "var(--admin-text-main)",
                fontSize: "0.84rem",
              }}
            />
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => {
                const name = newAssignee.trim();
                if (name) {
                  markDirty();
                  setAssignees([...assignees, name]);
                  setNewAssignee("");
                }
              }}
            >
              Add
            </button>
          </div>
        </div>
      </article>

      {/* Data Management & Archives */}
      <article className="admin-card accent-amber">
        <div className="panel-header-row">
          <div>
            <span className="panel-eyebrow">DATA GOVERNANCE</span>
            <h3 className="panel-title">Archived Records & Retention</h3>
          </div>
        </div>

        <p className="kpi-caption" style={{ margin: "0 0 16px" }}>
          Access historical conversations, restore soft-deleted leads, or execute permanent system purges.
        </p>

        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={onOpenArchived}
        >
          <Icon name="archive" />
          <span>Open Archive & Data Management</span>
        </button>

        <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--admin-border)" }}>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            disabled={!dirty || saving}
            onClick={() => void saveSettings()}
          >
            {saving ? "Saving Preferences..." : "Save Workspace Settings"}
          </button>
        </div>
      </article>

      {/* Assignee Deletion Safety Modal */}
      {pendingDelete && (
        <div className="inspector-drawer-overlay" role="dialog" aria-modal="true">
          <div className="inspector-drawer-sheet" style={{ width: "min(500px, 100vw)" }}>
            <div className="drawer-header">
              <div className="drawer-header-info">
                <h2>Delete Assignee</h2>
              </div>
              <button
                type="button"
                className="icon-action-btn"
                onClick={() => setPendingDelete(null)}
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="drawer-body-scroll">
              <p style={{ fontSize: "0.85rem", color: "var(--admin-text-main)" }}>
                {pendingDelete.affectedCount
                  ? `"${pendingDelete.assignee}" is currently assigned to ${pendingDelete.projectCount} active project(s). Choose how to handle these assignments before deleting.`
                  : `Are you sure you want to delete "${pendingDelete.assignee}"?`}
              </p>

              {deleteError && (
                <div style={{ padding: "8px 12px", background: "rgba(244, 63, 94, 0.15)", color: "var(--chart-rose)", borderRadius: "4px" }}>
                  {deleteError}
                </div>
              )}

              {pendingDelete.affectedCount > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.84rem" }}>
                    <input
                      type="radio"
                      name="assignee-delete-mode"
                      checked={deleteMode === "reassign"}
                      onChange={() => setDeleteMode("reassign")}
                    />
                    Reassign active projects to:
                  </label>
                  <select
                    disabled={deleteMode !== "reassign"}
                    value={replacementName}
                    onChange={(e) => setReplacementName(e.target.value)}
                    style={{
                      background: "var(--admin-panel-2)",
                      border: "1px solid var(--admin-border)",
                      borderRadius: "var(--admin-radius-sm)",
                      padding: "6px 10px",
                      color: "var(--admin-text-main)",
                    }}
                  >
                    <option value="">Choose team replacement</option>
                    {replacementOptions.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>

                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.84rem" }}>
                    <input
                      type="radio"
                      name="assignee-delete-mode"
                      checked={deleteMode === "unassign"}
                      onChange={() => setDeleteMode("unassign")}
                    />
                    Mark projects as Unassigned
                  </label>
                </div>
              )}
            </div>

            <div className="drawer-footer">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                disabled={!canDelete || deleteBusy}
                onClick={() => void confirmDeleteAssignee()}
              >
                {deleteBusy ? "Deleting..." : "Confirm & Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
