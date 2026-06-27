import { handleAdminLeadsRequest } from "../../server/handlers/adminWorkspaceHandler.js";

export default async function handler(req, res) {
  return handleAdminLeadsRequest(req, res);
}

