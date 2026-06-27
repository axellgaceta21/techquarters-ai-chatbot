import { handleAdminSourcesRequest } from "../../server/handlers/adminWorkspaceHandler.js";

export default async function handler(req, res) {
  return handleAdminSourcesRequest(req, res);
}

