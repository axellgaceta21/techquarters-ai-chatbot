import PanelHeader from "../common/PanelHeader";

export type TrendPoint = {
  label: string;
  leads: number;
  conversations: number;
  qualified: number;
  booked: number;
};

export default function LeadActivityTrend({
  points,
  rangeText,
}: {
  points: TrendPoint[];
  rangeText: string;
}) {
  const series = [
    { key: "leads" as const, label: "Leads Created", color: "var(--chart-blue)" },
    { key: "conversations" as const, label: "Conversations Opened", color: "var(--chart-teal)" },
    { key: "qualified" as const, label: "Qualified Leads", color: "var(--chart-amber)" },
    { key: "booked" as const, label: "Confirmed Booked", color: "var(--chart-green)" },
  ];

  const hasData = points.some((point) => series.some((item) => point[item.key] > 0));
  const maxValue = Math.max(1, ...points.flatMap((point) => series.map((item) => point[item.key])));
  const width = 640;
  const height = 220;
  const left = 34;
  const right = 18;
  const top = 20;
  const bottom = 34;

  const xFor = (index: number) =>
    left + (points.length <= 1 ? 0 : (index / (points.length - 1)) * (width - left - right));
  const yFor = (value: number) => top + (1 - value / maxValue) * (height - top - bottom);

  return (
    <article className="admin-card accent-blue">
      <PanelHeader eyebrow="ACTIVITY SIGNALS" title="Lead & Activity Trend" badge={rangeText} />

      {hasData ? (
        <div className="line-chart-container">
          <svg className="line-chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Lead activity trend chart">
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
              <line
                key={tick}
                x1={left}
                x2={width - right}
                y1={top + tick * (height - top - bottom)}
                y2={top + tick * (height - top - bottom)}
                stroke="var(--admin-border-subtle)"
                strokeDasharray="4 4"
              />
            ))}
            {series.map((item) => {
              const path = points
                .map((point, index) => `${index ? "L" : "M"} ${xFor(index)} ${yFor(point[item.key])}`)
                .join(" ");
              return (
                <g key={item.key}>
                  <path
                    d={path}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {points.map((point, index) => (
                    <circle
                      key={`${item.key}-${point.label}`}
                      cx={xFor(index)}
                      cy={yFor(point[item.key])}
                      r="3.5"
                      fill={item.color}
                      stroke="var(--admin-bg-elevated)"
                      strokeWidth="1.5"
                    >
                      <title>{`${item.label}: ${point[item.key]} on ${point.label}`}</title>
                    </circle>
                  ))}
                </g>
              );
            })}
            {points.map((point, index) => (
              <text
                key={point.label}
                x={xFor(index)}
                y={height - 10}
                fill="var(--admin-text-muted)"
                fontSize="10"
                textAnchor="middle"
              >
                {point.label}
              </text>
            ))}
          </svg>

          <div className="chart-legend-row">
            {series.map((item) => (
              <span key={item.key} className="legend-item">
                <span className="legend-dot" style={{ background: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="kpi-caption" style={{ padding: "40px 0", textAlign: "center" }}>
          No dated activity logged for this range yet.
        </p>
      )}
    </article>
  );
}
