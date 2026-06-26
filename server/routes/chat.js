import express from "express";
import { generateChatResponse } from "../services/aiService.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages must be an array" });
    }

    const response = await generateChatResponse(messages);
    res.json(response);
  } catch (err) {
    console.error("AI route error:", err);

    res.status(500).json({
      error: err.message || "AI request failed",
    });
  }
});

export default router;