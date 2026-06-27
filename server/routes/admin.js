import express from "express";
import { handleAdminDashboardRequest } from "../handlers/adminDashboardHandler.js";
import {
  handleAdminConversationDetailRequest,
  handleAdminConversationsRequest,
  handleAdminLeadsRequest,
  handleAdminSourcesRequest,
  handleAdminSettingsRequest,
  handleAdminAssigneesRequest,
} from "../handlers/adminWorkspaceHandler.js";

const router = express.Router();

router.get("/dashboard", handleAdminDashboardRequest);
router.get("/conversations", handleAdminConversationsRequest);
router.patch("/conversations", handleAdminConversationsRequest);
router.delete("/conversations", handleAdminConversationsRequest);
router.get("/conversation-detail", handleAdminConversationDetailRequest);
router.get("/leads", handleAdminLeadsRequest);
router.patch("/leads/:id", handleAdminLeadsRequest);
router.get("/sources", handleAdminSourcesRequest);
router.get("/settings", handleAdminSettingsRequest);
router.patch("/settings", handleAdminSettingsRequest);
router.get("/assignees", handleAdminAssigneesRequest);
router.patch("/assignees", handleAdminAssigneesRequest);

export default router;

