import PanelHeader from "../common/PanelHeader";
import { pct } from "../../../pages/dashboardService";

export type SourceMixItem = {
  label: string;
  value: number;
  color: string;
  accent: string;
};

export default function SourceMixChart({
  items,
  total,
}: {
  items: SourceMixItem[];
  total: number;
}) {
  let offset = 0;

  return (
    <article className="admin-card accent-blue">
      <PanelHeader eyebrow="ACQUISITION CHANNELS" title="Lead Source Mix" badge="Live Attribution" />

      {total > 0 ? (
        <div className="donut-chart-layout">
          <div className="donut-svg-wrap">
            <svg viewBox="0 0 42 42" role="img" aria-label="Lead source mix donut chart">
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
                    key={item.label}
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
              <span className="donut-center-sub">Leads</span>
            </div>
          </div>

          <div className="donut-legend-list">
            {items.map((item) => {
              const share = (item.value / total) * 100;
              return (
                <div key={item.label} className="donut-legend-item">
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
          No source or UTM campaign data captured in this range.
        </p>
      )}
    </article>
  );
}
