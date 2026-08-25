import PanelHeader from "../common/PanelHeader";
import Icon from "../../ui/Icon";
import { pct, type DashboardData } from "../../../pages/dashboardService";

export default function FunnelJourneyCard({
  funnel,
  shown,
  clicked,
  booked,
  calendly,
}: {
  funnel?: DashboardData["funnel"];
  shown: number;
  clicked: number;
  booked: number;
  calendly?: DashboardData["calendly"];
}) {
  const stages = [
    { key: "landed", label: "Landed", value: funnel?.stages.landed || 0, accent: "gray" },
    { key: "engaged", label: "Engaged", value: funnel?.stages.engaged || 0, accent: "blue" },
    { key: "qualified", label: "Qualified", value: funnel?.stages.qualified || 0, accent: "amber" },
    { key: "booked", label: "Booked", value: funnel?.stages.booked || 0, accent: "green" },
  ];

  const bookingActions = [
    { key: "offered", label: "Offered", value: shown, accent: "blue" },
    { key: "clicked", label: "Clicked", value: clicked, accent: "amber" },
    { key: "confirmed", label: "Confirmed", value: booked, accent: "green" },
  ];

  const maxFunnel = Math.max(1, ...stages.map((s) => s.value));
  const maxBooking = Math.max(1, ...bookingActions.map((s) => s.value));

  return (
    <article className="admin-card funnel-journey-card">
      <PanelHeader
        eyebrow="CONVERSION PERFORMANCE"
        title="Lead-to-Booking Journey"
        badge={`Overall Booked: ${pct(funnel?.conversions.overallBooked || 0)}`}
      />

      <div className="funnel-flow-group">
        <span className="panel-eyebrow" style={{ marginTop: "4px" }}>
          Full Acquisition Funnel
        </span>
        <div className="funnel-flow-steps">
          {stages.map((stage) => {
            const percentWidth = (stage.value / maxFunnel) * 100;
            return (
              <div key={stage.key} className={`funnel-step-box accent-${stage.accent}`}>
                <div className="funnel-step-header">
                  <span className="funnel-step-label">{stage.label}</span>
                  <strong className="funnel-step-val">{stage.value}</strong>
                </div>
                <div className="funnel-step-bar">
                  <div className="funnel-step-fill" style={{ width: `${percentWidth}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="funnel-flow-group" style={{ marginTop: "10px" }}>
        <span className="panel-eyebrow">Booking Flow Interactivity</span>
        <div className="funnel-flow-steps" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          {bookingActions.map((stage) => {
            const percentWidth = (stage.value / maxBooking) * 100;
            return (
              <div key={stage.key} className={`funnel-step-box accent-${stage.accent}`}>
                <div className="funnel-step-header">
                  <span className="funnel-step-label">{stage.label}</span>
                  <strong className="funnel-step-val">{stage.value}</strong>
                </div>
                <div className="funnel-step-bar">
                  <div className="funnel-step-fill" style={{ width: `${percentWidth}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="chart-legend-row" style={{ fontSize: "0.76rem" }}>
        <span>Offered &gt; Clicked: <b>{pct(calendly?.shownToClicked || 0)}</b></span>
        <span>Clicked &gt; Booked: <b>{pct(calendly?.clickedToBooked || 0)}</b></span>
        <span>Offered &gt; Booked: <b>{pct(calendly?.shownToBooked || 0)}</b></span>
      </div>

      {funnel?.largestLeak && funnel.largestLeak.dropoffRate > 0 && (
        <div className="funnel-leak-alert">
          <Icon name="spark" />
          <span>
            <b>Conversion Leak Diagnostic:</b> Largest drop-off occurs at{" "}
            <b>{funnel.largestLeak.label}</b> with a drop-off rate of{" "}
            <b>{pct(funnel.largestLeak.dropoffRate)}</b>.
          </span>
        </div>
      )}
    </article>
  );
}
