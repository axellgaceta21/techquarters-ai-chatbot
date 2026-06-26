import express from "express";
import { handleEventsRequest } from "../handlers/eventsHandler.js";

const router = express.Router();

router.post("/", handleEventsRequest);

export default router;
