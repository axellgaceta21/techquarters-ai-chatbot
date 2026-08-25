import Icon from "../../ui/Icon";
import ScoreBadge from "../common/ScoreBadge";
import {
  type ConversationRow,
  bookingTableStatus,
  dateTime,
} from "../../../pages/dashboardService";

export default function ConversationTable({
  rows,
  selected,
  setSelected,
  selectMode,
  onView,
  displayTimezone,
}: {
  rows: ConversationRow[];
  selected: string[];
  setSelected: (ids: string[]) => void;
  selectMode: boolean;
  onView: (row: ConversationRow) => void;
  displayTimezone: string;
}) {
  const allSelected = rows.length > 0 && selected.length === rows.length;

  return (
    <div className="admin-table-container">
      <table className="modern-data-table">
        <thead>
          <tr>
            {selectMode && (
              <th style={{ width: "40px" }}>
                <input
                  type="checkbox"
                  aria-label="Select all visible leads"
                  checked={allSelected}
                  onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                />
              </th>
            )}
            <th>Contact / Lead</th>
            <th>Business Entity</th>
            <th>Intent Score</th>
            <th>Booking State</th>
            <th>Core Challenge</th>
            <th>AI Summary</th>
            <th>Last Activity</th>
            <th style={{ textAlign: "right" }}>Inspect</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => {
              const isChecked = selected.includes(row.id);
              return (
                <tr
                  key={row.id}
                  className="table-row-hover"
                  onClick={() => onView(row)}
                  style={{
                    background: isChecked ? "rgba(139, 92, 246, 0.08)" : undefined,
                  }}
                >
                  {selectMode && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.displayName}`}
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelected([...selected, row.id]);
                          } else {
                            setSelected(selected.filter((id) => id !== row.id));
                          }
                        }}
                      />
                    </td>
                  )}
                  <td>
                    <div className="lead-identity-cell">
                      <span className="lead-name-text">{row.displayName || "Anonymous Visitor"}</span>
                      <span className="lead-email-sub">{row.email || "No email stored"}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: "var(--admin-text-main)" }}>
                      {row.businessName || "Not captured"}
                    </span>
                  </td>
                  <td>
                    <ScoreBadge score={row.score} />
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color:
                          row.calendlyStatus === "Confirmed Booked"
                            ? "var(--chart-green)"
                            : row.calendlyStatus === "Clicked"
                            ? "var(--chart-amber)"
                            : "var(--admin-text-muted)",
                      }}
                    >
                      {bookingTableStatus(row.calendlyStatus)}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--admin-text-main)",
                        maxWidth: "200px",
                        display: "inline-block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={row.mainProblem || "Not captured"}
                    >
                      {row.mainProblem || "—"}
                    </span>
                  </td>
                  <td>
                    <span className="summary-clamp-text" title={row.summary || "No AI summary available."}>
                      {row.summary || "Conversation active without summary."}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: "0.76rem", color: "var(--admin-text-muted)", whiteSpace: "nowrap" }}>
                      {dateTime(row.lastActivity, displayTimezone)}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="icon-action-btn"
                      onClick={() => onView(row)}
                      title="Inspect transcript and lead details"
                      aria-label="Inspect transcript and lead details"
                      style={{ display: "inline-grid" }}
                    >
                      <Icon name="eye" />
                    </button>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={selectMode ? 9 : 8} style={{ padding: "48px 16px", textAlign: "center" }}>
                <p className="kpi-caption" style={{ fontSize: "0.9rem" }}>
                  No lead sessions matching the current filter criteria.
                </p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
