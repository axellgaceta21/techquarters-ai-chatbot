import { handleEventsRequest } from "../server/handlers/eventsHandler.js";

export default async function handler(req, res) {
  return handleEventsRequest(req, res);
}
