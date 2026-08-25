import { useState } from "react";
import Icon from "../../ui/Icon";
import ScoreBadge from "../common/ScoreBadge";
import {
  type ConversationRow,
  bookingDetailStatus,
  dateTime,
  normalizeTags,
} from "../../../pages/dashboardService";

export default function ArchivedDataModal({
  rows,
  selected,
  setSelected,
  onClose,
  onRestore,
  onDelete,
  displayTimezone,
}: {
  rows: ConversationRow[];
  selected: string[];
  setSelected: (ids: string[]) => void;
  onClose: () => void;
  onRestore: (ids: string[]) => void;
  onDelete: (ids: string[]) => void;
  displayTimezone: string;
}) {
  const [viewing, setViewing] = useState<ConversationRow | null>(null);
  const allSelected = rows.length > 0 && selected.length === rows.length;

  return (
    <div className="inspector-drawer-overlay" role="dialog" aria-modal="true">
      <div className="inspector-drawer-sheet" style={{ width: "min(840px, 100vw)" }}>
        <div className="drawer-header">
          <div className="drawer-header-info">
            <h2>Archived Leads & Projects</h2>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--admin-text-muted)" }}>
              Safely inspect, restore, or permanently purge archived records.
            </p>
          </div>
          <button
            type="button"
            className="icon-action-btn"
            onClick={onClose}
            title="Close archived records"
            aria-label="Close archived records"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="drawer-body-scroll">
          {/* Quick Actions Toolbar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                disabled={selected.length === 0}
                onClick={() => onRestore(selected)}
              >
                <Icon name="archive" />
                <span>Restore Selected ({selected.length})</span>
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                disabled={selected.length === 0}
                onClick={() => onDelete(selected)}
              >
                <Icon name="trash" />
                <span>Delete Selected</span>
              </button>
            </div>

            <button
              type="button"
              className="admin-btn admin-btn-danger"
              disabled={rows.length === 0}
              onClick={() => {
                const phrase = window.prompt(`Type DELETE ${rows.length} to permanently delete all archived records.`);
                if (phrase === `DELETE ${rows.length}`) onDelete(rows.map((r) => r.id));
              }}
            >
              <Icon name="trash" />
              <span>Purge All Archived</span>
            </button>
          </div>

          {viewing && (
            <article className="admin-card accent-violet" style={{ marginTop: "10px" }}>
              <div className="panel-header-row">
                <div>
                  <h3 className="panel-title">{viewing.displayName}</h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)" }}>
                    {viewing.businessName || "No business entity"}
                  </span>
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setViewing(null)}
                  style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                >
                  Close Inspection
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", fontSize: "0.82rem" }}>
                <div>
                  <b>Main Challenge:</b> <p style={{ margin: "4px 0" }}>{viewing.mainProblem || "Not captured"}</p>
                </div>
                <div>
                  <b>AI Summary:</b> <p style={{ margin: "4px 0" }}>{viewing.summary || "No summary"}</p>
                </div>
                <div>
                  <b>Archived At:</b> {dateTime(viewing.archivedAt, displayTimezone)}
                </div>
                <div>
                  <b>Booking State:</b> {bookingDetailStatus(viewing.calendlyStatus)}
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <b>Tags:</b> {normalizeTags(viewing.lead?.tags).join(", ") || "None"}
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "12px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => onRestore([viewing.id])}
                >
                  Restore This Lead
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-danger"
                  onClick={() => onDelete([viewing.id])}
                >
                  Delete Permanently
                </button>
              </div>
            </article>
          )}

          {/* Archived Table */}
          <div className="admin-table-container">
            <table className="modern-data-table">
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>
                    <input
                      type="checkbox"
                      aria-label="Select all archived"
                      checked={allSelected}
                      onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                    />
                  </th>
                  <th>Contact / Project</th>
                  <th>Business Entity</th>
                  <th>Score</th>
                  <th>Archive Date</th>
                  <th>Booking State</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.includes(row.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelected([...selected, row.id]);
                            } else {
                              setSelected(selected.filter((id) => id !== row.id));
                            }
                          }}
                        />
                      </td>
                      <td>
                        <b>{row.displayName}</b>
                      </td>
                      <td>{row.businessName || "—"}</td>
                      <td>
                        <ScoreBadge score={row.score} />
                      </td>
                      <td>
                        <span style={{ fontSize: "0.76rem", color: "var(--admin-text-muted)" }}>
                          {dateTime(row.archivedAt, displayTimezone)}
                        </span>
                      </td>
                      <td>{bookingDetailStatus(row.calendlyStatus)}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="icon-action-btn"
                          onClick={() => setViewing(row)}
                          title="Inspect archived record"
                          style={{ display: "inline-grid", marginRight: "4px" }}
                        >
                          <Icon name="eye" />
                        </button>
                        <button
                          type="button"
                          className="icon-action-btn"
                          onClick={() => onRestore([row.id])}
                          title="Restore lead"
                          style={{ display: "inline-grid" }}
                        >
                          <Icon name="archive" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: "48px 16px", textAlign: "center" }}>
                      <p className="kpi-caption">No archived records found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="drawer-footer">
          <span style={{ fontSize: "0.78rem", color: "var(--admin-text-muted)" }}>
            Total Archived: <b>{rows.length}</b> records
          </span>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
