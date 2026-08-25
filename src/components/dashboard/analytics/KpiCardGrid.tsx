import Icon, { type IconName } from "../../ui/Icon";
import AnimatedNumber from "../common/AnimatedNumber";
import type { DashboardData } from "../../../pages/dashboardService";

type KpiItem = {
  key: string;
  label: string;
  value: number;
  caption: string;
  icon: IconName;
  accentClass: string;
};

export default function KpiCardGrid({
  kpis,
  isLoading,
}: {
  kpis?: DashboardData["kpis"];
  isLoading: boolean;
}) {
  const totalLeads = kpis?.totalLeads || 0;
  const qualifiedLeads = (kpis?.highIntentLeads || 0) + (kpis?.mediumIntentLeads || 0);
  const bookingClicked = kpis?.calendlyClicked || 0;
  const bookedCalls = kpis?.bookedCalls || 0;

  const items: KpiItem[] = [
    {
      key: "total",
      label: "Total Leads",
      value: totalLeads,
      caption: "All captured lead sessions in range",
      icon: "agent",
      accentClass: "kpi-blue",
    },
    {
      key: "qualified",
      label: "Qualified Leads",
      value: qualifiedLeads,
      caption: "High & medium intent opportunities",
      icon: "spark",
      accentClass: "kpi-amber",
    },
    {
      key: "clicked",
      label: "Booking Clicked",
      value: bookingClicked,
      caption: "Visitors engaging with booking flow",
      icon: "calendar",
      accentClass: "kpi-violet",
    },
    {
      key: "booked",
      label: "Confirmed Booked",
      value: bookedCalls,
      caption: "Scheduled discovery & strategy calls",
      icon: "check",
      accentClass: "kpi-green",
    },
  ];

  return (
    <section className="kpi-cards-grid" aria-label="Key Performance Indicators">
      {items.map((item) => (
        <article key={item.key} className={`admin-card kpi-card ${item.accentClass}`}>
          <div className="kpi-top-row">
            <h3>{item.label}</h3>
            <div className="kpi-icon-pill">
              <Icon name={item.icon} />
            </div>
          </div>
          <div className="kpi-value-row">
            {isLoading ? (
              <span className="kpi-value">...</span>
            ) : (
              <span className="kpi-value">
                <AnimatedNumber value={item.value} />
              </span>
            )}
          </div>
          <p className="kpi-caption">{item.caption}</p>
        </article>
      ))}
    </section>
  );
}
