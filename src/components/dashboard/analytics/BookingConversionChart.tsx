import PanelHeader from "../common/PanelHeader";

export default function BookingConversionChart({
  shown,
  clicked,
  booked,
  manual,
}: {
  shown: number;
  clicked: number;
  booked: number;
  manual: number;
}) {
  const columns = [
    { label: "Offered", value: shown, color: "var(--chart-blue)" },
    { label: "Clicked", value: clicked, color: "var(--chart-amber)" },
    { label: "Confirmed", value: booked, color: "var(--chart-green)" },
    { label: "Manual", value: manual, color: "var(--chart-violet)" },
  ];

  const maxValue = Math.max(1, ...columns.map((c) => c.value));

  return (
    <article className="admin-card accent-violet">
      <PanelHeader eyebrow="CALENDLY PERFORMANCE" title="Booking Conversion Volume" badge="Live Data" />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "10px",
          alignItems: "end",
          height: "140px",
          paddingTop: "8px",
          margin: "auto 0 0",
        }}
      >
        {columns.map((col) => {
          const heightPercent = (col.value / maxValue) * 100;
          return (
            <div
              key={col.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                height: "100%",
                justifyContent: "flex-end",
              }}
            >
              <strong style={{ fontSize: "0.95rem", fontVariantNumeric: "tabular-nums" }}>{col.value}</strong>
              <div
                style={{
                  width: "100%",
                  height: "85px",
                  background: "var(--admin-panel-2)",
                  border: "1px solid var(--admin-border)",
                  borderRadius: "var(--admin-radius-sm)",
                  display: "flex",
                  alignItems: "flex-end",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${Math.max(6, heightPercent)}%`,
                    background: col.color,
                    borderRadius: "3px 3px 0 0",
                    transition: "height 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: "750",
                  textTransform: "uppercase",
                  color: "var(--admin-text-muted)",
                  letterSpacing: "0.02em",
                }}
              >
                {col.label}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
