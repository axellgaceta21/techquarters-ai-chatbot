import { handleAdminSettingsRequest } from "../../server/handlers/adminWorkspaceHandler.js";

export default async function handler(req, res) {
  return handleAdminSettingsRequest(req, res);
}
