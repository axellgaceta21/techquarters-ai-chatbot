import type { ScoreBucket } from "../../../pages/dashboardService";

export default function ScoreBadge({ score }: { score?: ScoreBucket | string | null }) {
  const norm = String(score || "unscored").toLowerCase();
  const label = norm === "unscored" ? "Unscored" : norm.charAt(0).toUpperCase() + norm.slice(1);
  return (
    <span className={`score-badge score-${norm}`}>
      <span className="score-dot" />
      {label}
    </span>
  );
}
