import Icon from "../../ui/Icon";
import { PAGE_TITLES, PAGE_DESCRIPTIONS, type PageKey, dateTime } from "../../../pages/dashboardService";

export default function DashboardHeader({
  activePage,
  onRefresh,
  isRefreshing,
  onOpenDrawer,
  lastUpdated,
  displayTimezone,
}: {
  activePage: PageKey;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  onOpenDrawer: () => void;
  lastUpdated: string | null;
  displayTimezone: string;
}) {
  return (
    <header className={`admin-topbar page-accent-${activePage}`}>
      <button
        type="button"
        className="mobile-nav-btn"
        onClick={onOpenDrawer}
        aria-label="Open mobile navigation"
      >
        <Icon name="menu" />
      </button>

      <div className="topbar-left">
        <div className="topbar-title-row">
          <h1>{PAGE_TITLES[activePage]}</h1>
          <button
            type="button"
            className={`icon-action-btn ${isRefreshing ? "spin" : ""}`}
            onClick={() => void onRefresh()}
            title={`Refresh ${PAGE_TITLES[activePage]}`}
            aria-label={`Refresh ${PAGE_TITLES[activePage]}`}
            disabled={isRefreshing}
          >
            <Icon name="refresh" />
          </button>
        </div>
        <p className="topbar-subtitle">{PAGE_DESCRIPTIONS[activePage]}</p>
      </div>

      <div className="topbar-actions">
        {lastUpdated && (
          <span className="panel-badge" title={`Timezone: ${displayTimezone}`}>
            Synced {dateTime(lastUpdated, displayTimezone)}
          </span>
        )}
      </div>
    </header>
  );
}
