import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fetchDashboardData } from "./dashboardService";
import Icon from "../components/ui/Icon";
import "../styles/dashboard.css";

const UNAUTHORIZED_MESSAGE = "This account does not have dashboard access.";
type LocationState = { message?: string; loggedOut?: boolean };

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = location.state as LocationState | null;
  const loggedOut = useMemo(
    () =>
      Boolean(
        state?.loggedOut ||
          searchParams.get("logged_out") === "1" ||
          sessionStorage.getItem("tq-admin-logout") === "1"
      ),
    [searchParams, state?.loggedOut]
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(
    loggedOut ? "You have been logged out securely." : state?.message || ""
  );
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [autoRedirect, setAutoRedirect] = useState(loggedOut);

  useEffect(() => {
    if (!loggedOut || !autoRedirect) return;
    if (countdown <= 0) {
      sessionStorage.removeItem("tq-admin-logout");
      navigate("/", { replace: true });
      return;
    }
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [autoRedirect, countdown, loggedOut, navigate]);

  function cancelRedirect() {
    if (autoRedirect) setAutoRedirect(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    cancelRedirect();
    setMessage("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error || !data.session?.access_token) {
        setMessage("Invalid email or password.");
        return;
      }
      try {
        await fetchDashboardData(data.session.access_token, "today");
        sessionStorage.removeItem("tq-admin-logout");
        navigate("/dashboard", { replace: true });
      } catch (accessError) {
        await supabase.auth.signOut();
        const status = (accessError as Error & { status?: number }).status;
        setMessage(status === 403 ? UNAUTHORIZED_MESSAGE : "Dashboard access could not be verified.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="admin-auth-page">
      <div className="admin-auth-panel">
        <Link className="admin-back-link" to="/">
          <Icon name="arrow" style={{ transform: "rotate(180deg)", width: "16px", height: "16px" }} />
          <span>Back to public website</span>
        </Link>

        <div>
          <span className="panel-eyebrow">
            <span className="legend-dot" style={{ background: "var(--chart-blue)", display: "inline-block", marginRight: "6px" }} />
            Admin Command Access
          </span>
          <h1>TechQuarters AI Dashboard</h1>
          <p>Sign in with your authorized admin credentials.</p>
        </div>

        {loggedOut && (
          <div className="logout-countdown">
            <p style={{ margin: 0, fontWeight: 600, color: "var(--admin-good)" }}>{message}</p>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>
              {autoRedirect
                ? `Returning to the TechQuarters website in ${countdown} seconds.`
                : "Automatic redirect cancelled."}
            </p>
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <Link
                className="admin-btn admin-btn-secondary"
                to="/"
                onClick={() => sessionStorage.removeItem("tq-admin-logout")}
                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
              >
                Back to Website
              </Link>
              <button
                className="admin-btn admin-btn-secondary"
                type="button"
                onClick={cancelRedirect}
                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
              >
                Stay on Login
              </button>
            </div>
          </div>
        )}

        <form className="admin-auth-form" onSubmit={handleSubmit} onFocus={cancelRedirect}>
          <label>
            Email Address
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
              placeholder="admin@techquarters.ai"
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
              placeholder="••••••••••••"
            />
          </label>

          {message && !loggedOut && <p className="admin-form-message">{message}</p>}

          <button className="admin-btn admin-btn-primary" disabled={isLoading} type="submit" style={{ padding: "12px", marginTop: "6px" }}>
            {isLoading ? "Signing In..." : "Sign In to Dashboard"}
          </button>
        </form>
      </div>
    </section>
  );
}
