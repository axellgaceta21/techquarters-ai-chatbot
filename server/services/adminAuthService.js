import { env } from "../config/env.js";
import { getSupabaseAdminClient } from "./supabaseAdminClient.js";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const [scheme, token] = String(header).split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : "";
}

function getAdminEmailAllowlist() {
  return env.ADMIN_EMAILS.split(",").map(normalizeEmail).filter(Boolean);
}

export async function requireAdminUser(req) {
  const token = getBearerToken(req);
  if (!token) {
    console.warn("Admin dashboard auth failed: missing bearer token");
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error: userError } = await supabase.auth.getUser(token);
  const user = data?.user;

  if (userError || !user) {
    console.warn("Admin dashboard auth failed: invalid bearer token", {
      message: userError?.message,
      status: userError?.status,
    });
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  const email = normalizeEmail(user.email);
  const allowlist = getAdminEmailAllowlist();
  if (!env.ADMIN_EMAILS) {
    console.warn("Admin dashboard allowlist notice: ADMIN_EMAILS is not configured; using admin_users role check only");
  }

  if (allowlist.length > 0 && !allowlist.includes(email)) {
    console.warn("Admin dashboard auth failed: email missing from ADMIN_EMAILS", { userId: user.id, email });
    const error = new Error("This account does not have dashboard access.");
    error.statusCode = 403;
    throw error;
  }

  const { data: adminRows, error: adminError } = await supabase
    .from("admin_users")
    .select("id, email, role")
    .eq("id", user.id)
    .eq("role", "admin")
    .limit(1);

  if (adminError) {
    console.error("Admin authorization query failed:", {
      userId: user.id,
      email,
      code: adminError.code,
      message: adminError.message,
      details: adminError.details,
      hint: adminError.hint,
    });
    const error = new Error("Dashboard authorization failed");
    error.statusCode = 500;
    throw error;
  }

  if (!adminRows?.length) {
    console.warn("Admin dashboard auth failed: missing admin_users record", { userId: user.id, email });
    const error = new Error("This account does not have dashboard access.");
    error.statusCode = 403;
    throw error;
  }

  return { user, admin: adminRows[0] };
}
