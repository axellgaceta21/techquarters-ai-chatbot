import Icon from "../../ui/Icon";
import {
  type LeadRow,
  PROJECT_STAGE_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  dateOnly,
  dateTime,
  stageClass,
} from "../../../pages/dashboardService";

export default function ProjectTable({
  leads,
  assignees,
  onUpdate,
  onView,
  displayTimezone,
}: {
  leads: LeadRow[];
  assignees: string[];
  onUpdate: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onView: (lead: LeadRow) => void;
  displayTimezone: string;
}) {
  return (
    <div className="admin-table-container">
      <table className="modern-data-table">
        <thead>
          <tr>
            <th>Project Details</th>
            <th>Client Organization</th>
            <th>Assignee</th>
            <th>Project Stage</th>
            <th>Contract Status</th>
            <th>Project Dates</th>
            <th>Last Updated</th>
            <th style={{ textAlign: "right" }}>Inspect</th>
          </tr>
        </thead>
        <tbody>
          {leads.length > 0 ? (
            leads.map((lead) => (
              <tr key={lead.id} className="table-row-hover" onClick={() => onView(lead)}>
                <td>
                  <div className="lead-identity-cell">
                    <span className="lead-name-text">
                      {lead.project_name || lead.business_name || "Client Project"}
                    </span>
                    <span className="lead-email-sub">
                      {lead.project_summary || lead.main_problem || "No description specified"}
                    </span>
                  </div>
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: "var(--admin-text-main)" }}>
                    {lead.business_name || lead.name || "Anonymous Client"}
                  </span>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <select
                    value={lead.owner_name || ""}
                    onChange={(e) => void onUpdate(lead.id, { owner_name: e.target.value })}
                    style={{
                      background: "var(--admin-panel-2)",
                      border: "1px solid var(--admin-border)",
                      borderRadius: "var(--admin-radius-sm)",
                      padding: "4px 8px",
                      color: "var(--admin-text-main)",
                      fontSize: "0.78rem",
                    }}
                  >
                    <option value="">Unassigned</option>
                    {assignees.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <select
                    className={`stage-select ${stageClass(lead.project_stage)}`}
                    value={lead.project_stage || "Not Started"}
                    onChange={(e) => void onUpdate(lead.id, { project_stage: e.target.value })}
                    style={{
                      background: "var(--admin-panel-2)",
                      border: "1px solid var(--admin-border)",
                      borderRadius: "var(--admin-radius-sm)",
                      padding: "4px 8px",
                      color: "var(--admin-text-main)",
                      fontSize: "0.78rem",
                    }}
                  >
                    {PROJECT_STAGE_OPTIONS.map((stg) => (
                      <option key={stg} value={stg}>
                        {stg}
                      </option>
                    ))}
                  </select>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <select
                    value={lead.contract_status || "Pending"}
                    onChange={(e) => void onUpdate(lead.id, { contract_status: e.target.value })}
                    style={{
                      background: "var(--admin-panel-2)",
                      border: "1px solid var(--admin-border)",
                      borderRadius: "var(--admin-radius-sm)",
                      padding: "4px 8px",
                      color: "var(--admin-text-main)",
                      fontSize: "0.78rem",
                    }}
                  >
                    {CONTRACT_STATUS_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <span style={{ fontSize: "0.74rem", color: "var(--admin-text-muted)" }}>
                    <b>Start:</b> {dateOnly(lead.project_start_date) || "TBD"}
                    <br />
                    <b>Due:</b> {dateOnly(lead.target_completion_date) || "TBD"}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: "0.74rem", color: "var(--admin-text-muted)" }}>
                    {dateTime(lead.updated_at || lead.created_at, displayTimezone)}
                  </span>
                </td>
                <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="icon-action-btn"
                    onClick={() => onView(lead)}
                    title="View & edit project details"
                    aria-label="View & edit project details"
                    style={{ display: "inline-grid" }}
                  >
                    <Icon name="eye" />
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8} style={{ padding: "48px 16px", textAlign: "center" }}>
                <p className="kpi-caption" style={{ fontSize: "0.9rem" }}>
                  No projects in this view. Convert a qualified lead from the Lead Pipeline to populate.
                </p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
