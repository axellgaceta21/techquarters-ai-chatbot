import { handleChatRequest } from "../server/handlers/chatHandler.js";

export default async function handler(req, res) {
  return handleChatRequest(req, res);
}
