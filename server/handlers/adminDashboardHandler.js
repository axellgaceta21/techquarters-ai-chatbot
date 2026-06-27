import { requireAdminUser } from "../services/adminAuthService.js";
import { getDashboardData } from "../services/dashboardService.js";
import { safeTimeZone } from "../services/timezoneService.js";

export async function handleAdminDashboardRequest(req, res) {
  if (req.method && req.method !== "GET") {
    res.setHeader?.("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);

    const { start, end, timeZone } = req.query || {};
    if (!start || !end || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) {
      return res.status(400).json({ error: "Valid start and end dates are required" });
    }

    const data = await getDashboardData({ start, end, timeZone: safeTimeZone(timeZone) });
    return res.json(data);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) console.error("Admin dashboard route error:", error);
    return res.status(statusCode).json({
      error: error.message || "Failed to load dashboard",
    });
  }
}

