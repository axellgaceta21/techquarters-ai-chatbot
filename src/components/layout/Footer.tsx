import { Link } from "react-router-dom";
import { services } from "../../data/siteData";

const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

export default function Footer() {
  return <footer className="footer"><div className="footer-glow"/><div className="container footer-grid">
    <div className="footer-brand"><Link to="/"><img src={logoUrl} alt="TechQuarters AI" /></Link><p>AI systems, automations, software, and growth infrastructure for businesses ready to scale.</p><a href="mailto:hello@techquarters.ai">hello@techquarters.ai</a></div>
    <div><h3>Explore</h3><Link to="/">Home</Link><Link to="/services">Services</Link><Link to="/systems">Systems</Link><Link to="/about">About</Link><Link to="/contact">Contact</Link></div>
    <div><h3>What we build</h3>{services.slice(0, 5).map(service => <Link to="/services" key={service.title}>{service.title}</Link>)}</div>
    <div><h3>Connect</h3><a href="#linkedin">LinkedIn</a><a href="#instagram">Instagram</a><a href="#x">X / Twitter</a><Link className="footer-admin-link" to="/admin/login">Admin Login</Link></div>
  </div><div className="container footer-bottom"><span>&copy; {new Date().getFullYear()} TechQuarters AI</span><span>Built for intelligent growth.</span></div></footer>;
}
