import { Link } from "react-router-dom";
import Icon, { type IconName } from "../../ui/Icon";
import { PAGE_TITLES, type PageKey } from "../../../pages/dashboardService";

export default function DashboardSidebar({
  activePage,
  setActivePage,
  sidebarCollapsed,
  setSidebarCollapsed,
  drawerOpen,
  setDrawerOpen,
  theme,
  setTheme,
}: {
  activePage: PageKey;
  setActivePage: (page: PageKey) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (val: boolean) => void;
  drawerOpen: boolean;
  setDrawerOpen: (val: boolean) => void;
  theme: string;
  setTheme: (theme: string) => void;
}) {
  const navItems: { key: PageKey; label: string; icon: IconName }[] = [
    { key: "dashboard", label: PAGE_TITLES.dashboard, icon: "growth" },
    { key: "pipeline", label: PAGE_TITLES.pipeline, icon: "agent" },
    { key: "projects", label: PAGE_TITLES.projects, icon: "calendar" },
    { key: "settings", label: PAGE_TITLES.settings, icon: "settings" },
  ];

  return (
    <>
      {drawerOpen && (
        <button
          className="admin-drawer-overlay open"
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close navigation drawer"
        />
      )}
      <aside className={`admin-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${drawerOpen ? "drawer-open" : ""}`}>
        <div className="sidebar-brand-row">
          <Link to="/" className="sidebar-brand-link" title="Return to public site">
            <img src="/logo.png" alt="TechQuarters logo" />
            {!sidebarCollapsed && <span className="sidebar-brand-text">TQ Dashboard</span>}
          </Link>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name={sidebarCollapsed ? "plus" : "minus"} />
          </button>
        </div>

        <nav className="sidebar-nav-list" aria-label="Dashboard Navigation">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`sidebar-nav-item nav-${item.key} ${activePage === item.key ? "active" : ""}`}
              onClick={() => {
                setActivePage(item.key);
                setDrawerOpen(false);
              }}
              title={item.label}
            >
              <Icon name={item.icon} />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
            {!sidebarCollapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
