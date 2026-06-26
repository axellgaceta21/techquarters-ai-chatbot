import express from "express";
import { sendToN8n } from "../services/n8nService.js";

const router = express.Router();
const FORWARDED_EVENTS = new Set([
  "conversation_summary_ready",
  "booking_offered",
  "booking_clicked",
]);

router.post("/", async (req, res) => {
  try {
    const event = req.body;

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
    return res.status(500).json({
      error: error.message || "Failed to process event",
    });
  }
});

export default router;