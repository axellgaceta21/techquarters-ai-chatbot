import PageHero from "../components/ui/PageHero";
import CaseStudyCard from "../components/site/CaseStudyCard";
import FinalCTA from "../components/site/FinalCTA";
import { caseStudies } from "../data/siteData";
export default function Systems() { return <><PageHero eyebrow="SYSTEMS & CASE STUDIES" title="Practical Systems. Measurable Leverage." copy="A look at the kinds of AI, automation, and software infrastructure we build to make complex operations feel simple."/><section className="section page-section"><div className="container systems-list">{caseStudies.map(item => <CaseStudyCard key={item.title} item={item} detailed/>)}</div></section><FinalCTA /></>; }
