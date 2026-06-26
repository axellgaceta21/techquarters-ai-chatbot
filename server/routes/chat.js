import express from "express";
import { handleChatRequest } from "../handlers/chatHandler.js";

const router = express.Router();

router.post("/", handleChatRequest);

export default router;
