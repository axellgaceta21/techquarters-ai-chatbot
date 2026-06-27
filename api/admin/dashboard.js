import { handleAdminDashboardRequest } from "../../server/handlers/adminDashboardHandler.js";

export default async function handler(req, res) {
  return handleAdminDashboardRequest(req, res);
}
