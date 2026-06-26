import { Link } from "react-router-dom";
import type { IconName } from "../ui/Icon";
import Icon from "../ui/Icon";
export default function ServiceCard({ service }: { service: { icon: string; title: string; description: string; short?: string } }) {
  return <article className="glass-card service-card"><div className="card-icon"><Icon name={service.icon as IconName}/></div><span className="card-number">0</span><h3>{service.title}</h3><p>{service.description}</p><Link to="/services">Learn more <Icon name="arrow"/></Link></article>;
}
