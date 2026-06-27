import { requireAdminUser } from "../services/adminAuthService.js";
import { safeTimeZone } from "../services/timezoneService.js";
import {
  archiveConversations,
  deleteConversations,
  getConversationDetail,
  leadsToCsv,
  listConversations,
  listLeadPipeline,
  sourceBreakdown,
  updateLead,
  getAdminSettings,
  updateAdminSettings,
  assigneeUsage,
  deleteAssignee,
} from "../services/adminWorkspaceService.js";

function methodNotAllowed(res, methods) {
  res.setHeader?.("Allow", methods.join(", "));
  return res.status(405).json({ error: "Method not allowed" });
}

function sendError(res, error, label) {
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) console.error(`${label} error:`, error);
  return res.status(statusCode).json({ error: error.message || "Request failed" });
}

export async function handleAdminConversationsRequest(req, res) {
  try {
    const actor = await requireAdminUser(req);
    if (req.method === "GET") return res.json(await listConversations(req.query || {}));
    if (req.method === "PATCH") return res.json(await archiveConversations(req.body || {}, actor));
    if (req.method === "DELETE") return res.json(await deleteConversations(req.body || {}, actor));
    return methodNotAllowed(res, ["GET", "PATCH", "DELETE"]);
  } catch (error) {
    return sendError(res, error, "Admin conversations");
  }
}

export async function handleAdminConversationDetailRequest(req, res) {
  try {
    await requireAdminUser(req);
    if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
    return res.json(await getConversationDetail(req.query?.id || req.params?.id));
  } catch (error) {
    return sendError(res, error, "Admin conversation detail");
  }
}

export async function handleAdminLeadsRequest(req, res) {
  try {
    const actor = await requireAdminUser(req);
    if (req.method === "GET") {
      const data = await listLeadPipeline(req.query || {});
      if (req.query?.format === "csv") {
        const today = new Date().toISOString().slice(0, 10);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="techquarters-leads-${today}.csv"`);
        return res.send(leadsToCsv(data.rows));
      }
      return res.json(data);
    }
    if (req.method === "PATCH") return res.json(await updateLead(req.query?.id || req.params?.id, req.body || {}, actor));
    return methodNotAllowed(res, ["GET", "PATCH"]);
  } catch (error) {
    return sendError(res, error, "Admin leads");
  }
}

export async function handleAdminSourcesRequest(req, res) {
  try {
    await requireAdminUser(req);
    if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
    const { start, end } = req.query || {};
    if (!start || !end || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) {
      return res.status(400).json({ error: "Valid start and end dates are required" });
    }
    return res.json(await sourceBreakdown({ start, end }));
  } catch (error) {
    return sendError(res, error, "Admin sources");
  }
}

export async function handleAdminSettingsRequest(req, res) {
  try {
    await requireAdminUser(req);
    if (req.method === "GET") return res.json(await getAdminSettings());
    if (req.method === "PATCH") {
      const body = req.body || {};
      return res.json(await updateAdminSettings({
        reporting_timezone: safeTimeZone(body.reporting_timezone),
      }));
    }
    return methodNotAllowed(res, ["GET", "PATCH"]);
  } catch (error) {
    return sendError(res, error, "Admin settings");
  }
}

export async function handleAdminAssigneesRequest(req, res) {
  try {
    const actor = await requireAdminUser(req);
    if (req.method === "GET") return res.json(await assigneeUsage(req.query?.name));
    if (req.method === "PATCH") return res.json(await deleteAssignee(req.body || {}, actor));
    return methodNotAllowed(res, ["GET", "PATCH"]);
  } catch (error) {
    return sendError(res, error, "Admin assignees");
  }
}
