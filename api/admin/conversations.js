import { handleAdminConversationsRequest } from "../../server/handlers/adminWorkspaceHandler.js";

export default async function handler(req, res) {
  return handleAdminConversationsRequest(req, res);
}

