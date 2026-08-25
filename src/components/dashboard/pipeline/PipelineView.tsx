import { useState } from "react";
import Icon from "../../ui/Icon";
import BulkActionBar from "./BulkActionBar";
import ConversationTable from "./ConversationTable";
import type { ConversationRow } from "../../../pages/dashboardService";

export default function PipelineView({
  conversations,
  conversationMeta,
  scoreFilter,
  setScoreFilter,
  conversationSize,
  setConversationSize,
  conversationArchiveView,
  setConversationArchiveView,
  selectMode,
  setSelectMode,
  selectedIds,
  setSelectedIds,
  onViewDetail,
  onArchiveSelected,
  onDeleteSelected,
  onExportCsv,
  displayTimezone,
}: {
  conversations: ConversationRow[];
  conversationMeta: { totalSessionCount: number; filteredCount: number };
  scoreFilter: string;
  setScoreFilter: (val: string) => void;
  conversationSize: string;
  setConversationSize: (val: string) => void;
  conversationArchiveView: string;
  setConversationArchiveView: (val: string) => void;
  selectMode: boolean;
  setSelectMode: (val: boolean) => void;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  onViewDetail: (row: ConversationRow) => void;
  onArchiveSelected: (archived: boolean) => Promise<void>;
  onDeleteSelected: () => Promise<void>;
  onExportCsv: () => Promise<void>;
  displayTimezone: string;
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRows = conversations.filter((row) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (row.displayName || "").toLowerCase().includes(term) ||
      (row.email || "").toLowerCase().includes(term) ||
      (row.businessName || "").toLowerCase().includes(term) ||
      (row.mainProblem || "").toLowerCase().includes(term) ||
      (row.summary || "").toLowerCase().includes(term)
    );
  });

  const filterOptions = ["scored", "all", "high", "medium", "low", "unscored"];

  return (
    <div className="pipeline-view-container">
      {/* Pipeline Toolbar */}
      <div className="pipeline-toolbar">
        <div className="toolbar-left-group">
          {filterOptions.map((f) => (
            <button
              key={f}
              type="button"
              className={`filter-chip-btn ${scoreFilter === f ? "active" : ""}`}
              onClick={() => {
                setScoreFilter(f);
                setSelectMode(false);
              }}
            >
              {f === "all" ? "All Sessions" : f}
            </button>
          ))}

          <div className="search-input-wrap">
            <Icon name="search" />
            <input
              type="text"
              placeholder="Search leads, email, business..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <select
            value={conversationSize}
            onChange={(e) => {
              setConversationSize(e.target.value);
              localStorage.setItem("tq-admin-default-page-size", e.target.value);
              setSelectMode(false);
            }}
            style={{
              background: "var(--admin-panel-2)",
              border: "1px solid var(--admin-border)",
              borderRadius: "var(--admin-radius-sm)",
              padding: "6px 10px",
              color: "var(--admin-text-main)",
              fontSize: "0.82rem",
            }}
          >
            <option value="10">Show 10</option>
            <option value="20">Show 20</option>
            <option value="50">Show 50</option>
            <option value="all">Show All</option>
          </select>

          <select
            value={conversationArchiveView}
            onChange={(e) => {
              setConversationArchiveView(e.target.value);
              setSelectMode(false);
            }}
            style={{
              background: "var(--admin-panel-2)",
              border: "1px solid var(--admin-border)",
              borderRadius: "var(--admin-radius-sm)",
              padding: "6px 10px",
              color: "var(--admin-text-main)",
              fontSize: "0.82rem",
            }}
          >
            <option value="active">Active Leads</option>
            <option value="archived">Archived</option>
          </select>

          <button
            type="button"
            className={`admin-btn ${selectMode ? "admin-btn-primary" : "admin-btn-secondary"}`}
            onClick={() => setSelectMode(!selectMode)}
          >
            <Icon name="check" />
            <span>{selectMode ? "Done Selecting" : "Select"}</span>
          </button>

          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={() => void onExportCsv()}
            title="Export CSV of filtered pipeline"
          >
            <Icon name="download" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Meta Counter & Subtitle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p className="kpi-caption" style={{ margin: 0 }}>
          Displaying <b>{filteredRows.length}</b> leads (of <b>{conversationMeta.totalSessionCount}</b> total registered sessions)
        </p>
      </div>

      {/* Floating Bulk Actions Bar */}
      {selectMode && (
        <BulkActionBar
          selectedCount={selectedIds.length}
          isArchivedView={conversationArchiveView === "archived"}
          onArchive={() => void onArchiveSelected(conversationArchiveView !== "archived")}
          onDelete={() => void onDeleteSelected()}
          onClear={() => setSelectedIds([])}
        />
      )}

      {/* Data Table */}
      <ConversationTable
        rows={filteredRows}
        selected={selectedIds}
        setSelected={setSelectedIds}
        selectMode={selectMode}
        onView={onViewDetail}
        displayTimezone={displayTimezone}
      />
    </div>
  );
}
