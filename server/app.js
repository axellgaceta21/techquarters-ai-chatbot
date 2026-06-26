import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import chatRoutes from "./routes/chat.js";
import eventRoutes from "./routes/events.js";

const app = express();
const PORT = env.PORT;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "TQ Chatbot API running" });
});

app.use("/api/chat", chatRoutes);
app.use("/api/events", eventRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("N8N loaded:", !!env.N8N_WEBHOOK_URL);
});