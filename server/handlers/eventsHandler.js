import { sendToN8n } from "../services/n8nService.js";

const FORWARDED_EVENTS = new Set([
  "conversation_summary_ready",
  "booking_offered",
  "booking_clicked",
]);

export async function handleEventsRequest(req, res) {
  if (req.method && req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const event = req.body || {};

    if (!event.event_type || !event.lead_id || !event.session_id) {
      return res.status(400).json({
        error: "event_type, lead_id, and session_id are required",
      });
    }

    if (!FORWARDED_EVENTS.has(event.event_type)) {
      return res.json({ success: true, forwarded: false });
    }

    await sendToN8n(event);
    return res.json({ success: true, forwarded: true });
  } catch (error) {
    console.error("Event route error:", error);
    return res.status(error.statusCode || 500).json({
      error: error.publicMessage || "Failed to process event",
    });
  }
}
