import { useState } from "react";
import Icon from "../../ui/Icon";
import ProjectKanbanBoard from "./ProjectKanbanBoard";
import ProjectTable from "./ProjectTable";
import type { LeadRow, ProjectStage } from "../../../pages/dashboardService";

export default function ProjectsView({
  leads,
  assignees,
  projectView,
  setProjectView,
  onUpdateLead,
  onViewProject,
  displayTimezone,
}: {
  leads: LeadRow[];
  assignees: string[];
  projectView: "ongoing" | "completed";
  setProjectView: (view: "ongoing" | "completed") => void;
  onUpdateLead: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onViewProject: (lead: LeadRow) => void;
  displayTimezone: string;
}) {
  const [layoutMode, setLayoutMode] = useState<"kanban" | "table">("kanban");
  const [searchTerm, setSearchTerm] = useState("");

  const completedProjects = leads.filter(
    (l) => (l.project_stage || "").trim().toLowerCase() === "completed"
  );
  const ongoingProjects = leads.filter(
    (l) => (l.project_stage || "").trim().toLowerCase() !== "completed"
  );

  const activeSet = projectView === "ongoing" ? ongoingProjects : completedProjects;

  const filteredProjects = activeSet.filter((l) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (l.project_name || "").toLowerCase().includes(term) ||
      (l.business_name || "").toLowerCase().includes(term) ||
      (l.name || "").toLowerCase().includes(term) ||
      (l.owner_name || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="projects-view-container">
      {/* Projects Toolbar */}
      <div className="projects-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-mode-btn ${projectView === "ongoing" ? "active" : ""}`}
              onClick={() => setProjectView("ongoing")}
            >
              Ongoing ({ongoingProjects.length})
            </button>
            <button
              type="button"
              className={`view-mode-btn ${projectView === "completed" ? "active" : ""}`}
              onClick={() => setProjectView("completed")}
            >
              Completed ({completedProjects.length})
            </button>
          </div>

          <div className="search-input-wrap">
            <Icon name="search" />
            <input
              type="text"
              placeholder="Search projects, client, assignee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-mode-btn ${layoutMode === "kanban" ? "active" : ""}`}
              onClick={() => setLayoutMode("kanban")}
              title="Kanban Board View"
            >
              <Icon name="kanban" />
              <span>Board</span>
            </button>
            <button
              type="button"
              className={`view-mode-btn ${layoutMode === "table" ? "active" : ""}`}
              onClick={() => setLayoutMode("table")}
              title="Table Grid View"
            >
              <Icon name="table" />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main View Renderer (Kanban or Table) */}
      {layoutMode === "kanban" ? (
        <ProjectKanbanBoard
          leads={filteredProjects}
          onViewProject={onViewProject}
          onUpdateStage={(id: string, stage: ProjectStage) => void onUpdateLead(id, { project_stage: stage })}
        />
      ) : (
        <ProjectTable
          leads={filteredProjects}
          assignees={assignees}
          onUpdate={onUpdateLead}
          onView={onViewProject}
          displayTimezone={displayTimezone}
        />
      )}
    </div>
  );
}
