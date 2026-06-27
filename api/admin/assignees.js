import { handleAdminAssigneesRequest } from "../../server/handlers/adminWorkspaceHandler.js";

export default async function handler(req, res) {
  return handleAdminAssigneesRequest(req, res);
}
