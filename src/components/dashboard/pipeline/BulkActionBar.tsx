import Icon from "../../ui/Icon";

export default function BulkActionBar({
  selectedCount,
  isArchivedView,
  onArchive,
  onDelete,
  onClear,
}: {
  selectedCount: number;
  isArchivedView: boolean;
  onArchive: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="bulk-action-floating-bar" role="toolbar" aria-label="Bulk actions">
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span className="bulk-count-badge">
          <b>{selectedCount}</b> {selectedCount === 1 ? "lead selected" : "leads selected"}
        </span>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={onClear}
          style={{ padding: "4px 10px", fontSize: "0.75rem" }}
        >
          Clear Selection
        </button>
      </div>

      <div className="bulk-buttons-group">
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={onArchive}
          title={isArchivedView ? "Restore selected leads" : "Archive selected leads"}
        >
          <Icon name="archive" />
          <span>{isArchivedView ? "Restore Selected" : "Archive Selected"}</span>
        </button>

        <button
          type="button"
          className="admin-btn admin-btn-danger"
          onClick={onDelete}
          title="Permanently delete selected leads"
        >
          <Icon name="trash" />
          <span>Delete Selected</span>
        </button>
      </div>
    </div>
  );
}
