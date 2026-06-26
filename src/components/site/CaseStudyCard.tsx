import { useChat } from "../../hooks/useChat";
import Icon from "../ui/Icon";
export default function CaseStudyCard({ item, detailed = false }: { item: { title: string; category: string; summary: string; problem: string; solution: string; outcome: string; tags: readonly string[]; metric: string; metricLabel: string }; detailed?: boolean }) {
  const { openChat } = useChat();
  return <article className={`case-card ${detailed ? "case-detailed" : ""}`}><div className="case-visual"><div className="case-orbit"/><span>{item.category}</span><strong>{item.metric}</strong><small>{item.metricLabel}</small></div><div className="case-body"><div className="tags">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div><h3>{item.title}</h3><p>{item.summary}</p>{detailed && <div className="case-details"><p><b>Problem</b>{item.problem}</p><p><b>Solution</b>{item.solution}</p><p><b>Outcome</b>{item.outcome}</p></div>}<button className="text-link" onClick={openChat}>{detailed ? "Discuss a similar project" : "Explore system"} <Icon name="arrow"/></button></div></article>;
}
