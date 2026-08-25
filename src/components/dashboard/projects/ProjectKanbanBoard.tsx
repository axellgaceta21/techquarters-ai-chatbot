import Icon from "../../ui/Icon";
import {
  type LeadRow,
  type ProjectStage,
  PROJECT_STAGE_OPTIONS,
  dateOnly,
} from "../../../pages/dashboardService";

export default function ProjectKanbanBoard({
  leads,
  onViewProject,
  onUpdateStage,
}: {
  leads: LeadRow[];
  onViewProject: (lead: LeadRow) => void;
  onUpdateStage: (id: string, stage: ProjectStage) => void;
}) {
  const columns: { stage: ProjectStage; label: string; accent: string }[] = [
    { stage: "Discovery", label: "Discovery", accent: "var(--chart-blue)" },
    { stage: "Planning", label: "Planning", accent: "var(--chart-violet)" },
    { stage: "Building", label: "Building", accent: "var(--chart-amber)" },
    { stage: "Review", label: "Review", accent: "var(--chart-orange)" },
    { stage: "Live", label: "Live / Handover", accent: "var(--chart-teal)" },
    { stage: "Completed", label: "Completed", accent: "var(--chart-green)" },
  ];

  return (
    <div className="kanban-board-scroll">
      <div className="kanban-columns-track">
        {columns.map((col) => {
          const colLeads = leads.filter(
            (lead) => (lead.project_stage || "Not Started") === col.stage
          );
          return (
            <div
              key={col.stage}
              className="kanban-column"
              style={{ borderTopColor: col.accent }}
            >
              <div className="kanban-col-header">
                <span className="kanban-col-title">{col.label}</span>
                <span className="kanban-col-count">{colLeads.length}</span>
              </div>

              <div className="kanban-cards-stack">
                {colLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="kanban-card"
                    onClick={() => onViewProject(lead)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <span className="kanban-card-title">
                        {lead.project_name || lead.business_name || "Client Project"}
                      </span>
                    </div>

                    <span className="kanban-card-client">
                      {lead.business_name || lead.name || "Client"}
                    </span>

                    {lead.project_summary && (
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.76rem",
                          color: "var(--admin-text-muted)",
                          lineHeight: 1.35,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {lead.project_summary}
                      </p>
                    )}

                    <div className="kanban-card-footer">
                      <span className="assignee-chip">
                        <Icon name="user" style={{ width: "13px", height: "13px" }} />
                        {lead.owner_name || "Unassigned"}
                      </span>

                      {lead.target_completion_date && (
                        <span style={{ color: "var(--admin-text-dim)", fontSize: "0.7rem" }}>
                          Due: {dateOnly(lead.target_completion_date)}
                        </span>
                      )}
                    </div>

                    {/* Quick Stage Progression */}
                    <div
                      style={{
                        marginTop: "6px",
                        display: "flex",
                        gap: "6px",
                        justifyContent: "flex-end",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <select
                        value={lead.project_stage || "Not Started"}
                        onChange={(e) => onUpdateStage(lead.id, e.target.value as ProjectStage)}
                        style={{
                          background: "var(--admin-panel-2)",
                          border: "1px solid var(--admin-border)",
                          borderRadius: "4px",
                          color: "var(--admin-text-muted)",
                          fontSize: "0.68rem",
                          padding: "2px 4px",
                        }}
                      >
                        {PROJECT_STAGE_OPTIONS.map((stg) => (
                          <option key={stg} value={stg}>
                            {stg}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}

                {colLeads.length === 0 && (
                  <div
                    style={{
                      padding: "24px 10px",
                      textAlign: "center",
                      color: "var(--admin-text-dim)",
                      fontSize: "0.75rem",
                    }}
                  >
                    No projects in this stage.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
