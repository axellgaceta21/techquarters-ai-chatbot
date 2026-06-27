import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fetchDashboardData } from "./dashboardService";

const UNAUTHORIZED_MESSAGE = "This account does not have dashboard access.";
type LocationState = { message?: string; loggedOut?: boolean };

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = location.state as LocationState | null;
  const loggedOut = useMemo(() => Boolean(state?.loggedOut || searchParams.get("logged_out") === "1" || sessionStorage.getItem("tq-admin-logout") === "1"), [searchParams, state?.loggedOut]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(loggedOut ? "You have been logged out securely." : state?.message || "");
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [autoRedirect, setAutoRedirect] = useState(loggedOut);

  useEffect(() => {
    if (!loggedOut || !autoRedirect) return;
    if (countdown <= 0) { sessionStorage.removeItem("tq-admin-logout"); navigate("/", { replace: true }); return; }
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [autoRedirect, countdown, loggedOut, navigate]);

  function cancelRedirect() { if (autoRedirect) setAutoRedirect(false); }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    cancelRedirect();
    setMessage("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.session?.access_token) { setMessage("Invalid email or password."); return; }
      try {
        await fetchDashboardData(data.session.access_token, "today");
        sessionStorage.removeItem("tq-admin-logout");
        navigate("/dashboard", { replace: true });
      } catch (accessError) {
        await supabase.auth.signOut();
        const status = (accessError as Error & { status?: number }).status;
        setMessage(status === 403 ? UNAUTHORIZED_MESSAGE : "Dashboard access could not be verified.");
      }
    } finally { setIsLoading(false); }
  }

  return <section className="admin-auth-page">
    <div className="admin-auth-panel">
      <Link className="admin-back-link" to="/">Back to homepage</Link>
      <div><span className="eyebrow"><i /> Admin Access</span><h1>TechQuarters Chatbot Dashboard</h1><p>Sign in with an authorized Supabase admin account.</p></div>
      {loggedOut ? <div className="logout-countdown"><p>{message}</p>{autoRedirect ? <p>Returning to the TechQuarters website in {countdown} seconds.</p> : <p>Automatic redirect cancelled.</p>}<div><Link className="button button-secondary" to="/" onClick={() => sessionStorage.removeItem("tq-admin-logout")}>Back to Website Now</Link><button className="button button-secondary" type="button" onClick={cancelRedirect}>Stay on Admin Login</button></div></div> : null}
      <form className="admin-auth-form" onSubmit={handleSubmit} onFocus={cancelRedirect}>
        <label>Email<input autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
        <label>Password<input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
        {message && !loggedOut ? <p className="admin-form-message">{message}</p> : null}
        <button className="button button-primary" disabled={isLoading} type="submit">{isLoading ? "Signing in..." : "Sign In"}</button>
      </form>
    </div>
  </section>;
}
