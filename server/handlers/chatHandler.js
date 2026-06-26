import { generateChatResponse } from "../services/aiService.js";

export async function handleChatRequest(req, res) {
  if (req.method && req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages } = req.body || {};

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages must be an array" });
    }

    const response = await generateChatResponse(messages);
    return res.json(response);
  } catch (err) {
    console.error("AI route error:", err);

    return res.status(err.statusCode || 500).json({
      error: err.publicMessage || "AI request failed",
    });
  }
}
