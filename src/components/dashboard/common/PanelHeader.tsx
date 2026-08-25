export default function PanelHeader({
  eyebrow,
  title,
  badge,
}: {
  eyebrow: string;
  title: string;
  badge?: string;
}) {
  return (
    <div className="panel-header-row">
      <div>
        <span className="panel-eyebrow">{eyebrow}</span>
        <h3 className="panel-title">{title}</h3>
      </div>
      {badge ? <span className="panel-badge">{badge}</span> : null}
    </div>
  );
}
