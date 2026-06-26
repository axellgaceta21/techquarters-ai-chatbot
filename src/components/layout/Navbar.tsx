import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { CALENDLY_URL } from "../../config/appConfig";
import { useChat } from "../../hooks/useChat";
import Icon from "../ui/Icon";

const links = [["Home", "/"], ["Services", "/services"], ["Systems", "/systems"], ["About", "/about"], ["Contact", "/contact"]];
const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { trackBookingClick } = useChat();
  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 18); onScroll(); window.addEventListener("scroll", onScroll); return () => window.removeEventListener("scroll", onScroll); }, []);
  return <header className={`navbar ${scrolled ? "navbar-scrolled" : ""}`}>
    <div className="container nav-inner">
      <Link to="/" className="brand" aria-label="TechQuarters AI home"><img src={logoUrl} alt="TechQuarters AI" /></Link>
      <nav className="desktop-nav" aria-label="Primary navigation">{links.map(([label, href]) => <NavLink key={href} to={href} className={({ isActive }) => isActive ? "active" : ""}>{label}</NavLink>)}</nav>
      <a className="button button-primary nav-cta" href={CALENDLY_URL} target="_blank" rel="noreferrer" onClick={trackBookingClick}><Icon name="calendar" /> Book a Strategy Call</a>
      <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Toggle menu"><Icon name={menuOpen ? "close" : "menu"} /></button>
    </div>
    <div className={`mobile-menu ${menuOpen ? "open" : ""}`}>{links.map(([label, href]) => <NavLink key={href} to={href} onClick={() => setMenuOpen(false)}>{label}</NavLink>)}<a className="button button-primary" href={CALENDLY_URL} target="_blank" rel="noreferrer" onClick={() => { setMenuOpen(false); trackBookingClick(); }}>Book a Strategy Call</a></div>
  </header>;
}