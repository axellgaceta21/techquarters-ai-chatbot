import { pct } from "../../../pages/dashboardService";

export default function SourcesTable({
  sources,
}: {
  sources: Record<string, any>[];
}) {
  return (
    <article className="admin-card accent-blue">
      <div className="panel-header-row">
        <div>
          <span className="panel-eyebrow">ATTRIBUTION & CONVERSION</span>
          <h3 className="panel-title">Source / UTM Channel Performance</h3>
        </div>
        <span className="panel-badge">{sources.length} Channels</span>
      </div>

      {sources.length > 0 ? (
        <div className="admin-table-container" style={{ marginTop: "12px" }}>
          <table className="modern-data-table">
            <thead>
              <tr>
                <th>Acquisition Source</th>
                <th style={{ textAlign: "right" }}>Total Leads</th>
                <th style={{ textAlign: "right" }}>High</th>
                <th style={{ textAlign: "right" }}>Med</th>
                <th style={{ textAlign: "right" }}>Low</th>
                <th style={{ textAlign: "right" }}>Offered</th>
                <th style={{ textAlign: "right" }}>Clicked</th>
                <th style={{ textAlign: "right" }}>Booked</th>
                <th style={{ textAlign: "right" }}>Qualified %</th>
                <th style={{ textAlign: "right" }}>Booked %</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((src, idx) => (
                <tr key={src.source || idx}>
                  <td style={{ fontWeight: 750 }}>{src.source || "Direct / Organic"}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{src.leads || 0}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--chart-green)" }}>
                    {src.high || 0}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--chart-amber)" }}>
                    {src.medium || 0}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--chart-gray)" }}>
                    {src.low || 0}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{src.calendlyShown || 0}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{src.clicked || 0}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--chart-green)", fontWeight: 700 }}>
                    {src.confirmedBooked || 0}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {pct(Number(src.qualifiedRate) || 0)}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--chart-blue)" }}>
                    {pct(Number(src.bookedRate) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="kpi-caption" style={{ padding: "40px 0", textAlign: "center" }}>
          No source channel records captured yet.
        </p>
      )}
    </article>
  );
}
