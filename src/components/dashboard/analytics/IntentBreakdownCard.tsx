import PanelHeader from "../common/PanelHeader";
import { pct, type ScoreBucket } from "../../../pages/dashboardService";

export default function IntentBreakdownCard({
  scores,
}: {
  scores?: { high: number; medium: number; low: number; unscored: number };
}) {
  const items: { label: string; key: ScoreBucket; value: number; color: string; accent: string }[] = [
    { label: "High Intent", key: "high", value: scores?.high || 0, color: "var(--chart-green)", accent: "green" },
    { label: "Medium Intent", key: "medium", value: scores?.medium || 0, color: "var(--chart-amber)", accent: "amber" },
    { label: "Low Intent", key: "low", value: scores?.low || 0, color: "var(--chart-gray)", accent: "gray" },
    { label: "Unscored", key: "unscored", value: scores?.unscored || 0, color: "var(--chart-violet)", accent: "violet" },
  ];

  const total = items.reduce((acc, curr) => acc + curr.value, 0);
  let offset = 0;

  return (
    <article className="admin-card accent-amber">
      <PanelHeader eyebrow="AI EVALUATION" title="Lead Intent Breakdown" badge="Live Scoring" />

      {total > 0 ? (
        <div className="donut-chart-layout">
          <div className="donut-svg-wrap">
            <svg viewBox="0 0 42 42" role="img" aria-label="Lead score breakdown donut chart">
              <circle
                cx="21"
                cy="21"
                r="15.915"
                fill="none"
                stroke="var(--admin-border-subtle)"
                strokeWidth="5"
              />
              {items.map((item) => {
                const share = (item.value / total) * 100;
                const segment = (
                  <circle
                    key={item.key}
                    cx="21"
                    cy="21"
                    r="15.915"
                    fill="none"
                    stroke={item.color}
                    strokeWidth="5"
                    strokeDasharray={`${share} ${100 - share}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 21 21)"
                    style={{ transition: "stroke-dasharray 0.5s ease" }}
                  >
                    <title>{`${item.label}: ${item.value} (${pct(share)})`}</title>
                  </circle>
                );
                offset += share;
                return segment;
              })}
            </svg>
            <div className="donut-center-text">
              <span className="donut-center-total">{total}</span>
              <span className="donut-center-sub">Scored</span>
            </div>
          </div>

          <div className="donut-legend-list">
            {items.map((item) => {
              const share = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div key={item.key} className="donut-legend-item">
                  <div className="donut-legend-left">
                    <span className="legend-dot" style={{ background: item.color }} />
                    <span>{item.label}</span>
                  </div>
                  <div className="donut-legend-right">
                    <strong>{item.value}</strong>
                    <span style={{ color: "var(--admin-text-muted)" }}>({pct(share)})</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="kpi-caption" style={{ padding: "40px 0", textAlign: "center" }}>
          No scoring signals found in this range.
        </p>
      )}
    </article>
  );
}
