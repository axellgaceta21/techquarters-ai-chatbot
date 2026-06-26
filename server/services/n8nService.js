import { env } from "../config/env.js";

export async function sendToN8n(payload) {
  const webhookUrl = env.N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("N8N_WEBHOOK_URL not set. Skipping n8n dispatch.");
    return { skipped: true };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  const body = await response.text();
  if (!response.ok) {
    console.error("n8n response:", response.status, body);
    throw new Error(`n8n returned ${response.status}`);
  }

  return { skipped: false, status: response.status };
}
