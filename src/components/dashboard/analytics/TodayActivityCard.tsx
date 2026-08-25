import PanelHeader from "../common/PanelHeader";
import Icon, { type IconName } from "../../ui/Icon";
import type { DashboardData } from "../../../pages/dashboardService";

export default function TodayActivityCard({
  activity,
  needingActionToday,
}: {
  activity?: DashboardData["todayActivity"];
  needingActionToday: number;
}) {
  const items: { label: string; value: number; icon: IconName; color: string }[] = [
    {
      label: "Website Visitors",
      value: activity?.websiteVisitors || 0,
      icon: "eye",
      color: "var(--chart-blue)",
    },
    {
      label: "Chat Opened",
      value: activity?.chatClicked || 0,
      icon: "chat",
      color: "var(--chart-violet)",
    },
    {
      label: "Conversations Active",
      value: activity?.conversationsOpened || 0,
      icon: "agent",
      color: "var(--chart-teal)",
    },
    {
      label: "Require Follow-up",
      value: needingActionToday,
      icon: "spark",
      color: "var(--chart-orange)",
    },
  ];

  return (
    <article className="admin-card accent-teal">
      <PanelHeader eyebrow="REAL-TIME ACTIVITY" title="Today's Operational Pulse" badge="Today" />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "8px",
          marginTop: "8px",
        }}
      >
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              background: "var(--admin-panel-2)",
              border: "1px solid var(--admin-border)",
              borderLeft: `3px solid ${item.color}`,
              borderRadius: "var(--admin-radius-sm)",
              padding: "8px 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "6px",
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
              <div
                style={{
                  color: item.color,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name={item.icon} style={{ width: "15px", height: "15px" }} />
              </div>
              <span
                style={{
                  fontSize: "0.74rem",
                  fontWeight: "600",
                  color: "var(--admin-text-main)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.label}
              </span>
            </div>
            <strong
              style={{
                fontSize: "1.1rem",
                fontWeight: "850",
                color: "var(--admin-text-main)",
                fontVariantNumeric: "tabular-nums",
                flexShrink: 0,
              }}
            >
              {item.value}
            </strong>
          </div>
        ))}
      </div>
    </article>
  );
}
