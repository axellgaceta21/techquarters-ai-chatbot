import { handleAdminConversationDetailRequest } from "../../server/handlers/adminWorkspaceHandler.js";

export default async function handler(req, res) {
  return handleAdminConversationDetailRequest(req, res);
}

