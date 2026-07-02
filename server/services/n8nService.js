import { env } from "../config/env.js";
import { getSupabaseAdminClient } from "./supabaseAdminClient.js";

const FAILURE_THRESHOLD = 3;
const PAUSE_MS = 5 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = 8;
const RETRY_WORKER_INTERVAL_MS = 60 * 1000;
const RETRY_LOOKBACK_LIMIT = 200;

const circuit = {
  failures: 0,
  pausedUntil: 0,
};

let retryWorkerStarted = false;
let retryWorkerRunning = false;

function nowIso() {
  return new Date().toISOString();
}

function sanitizedError(error) {
  const message = error?.message || "n8n delivery failed";
  return message.replace(env.N8N_WEBHOOK_URL || "", "[n8n-webhook]").slice(0, 180);
}

function nextRetryAt(attempts) {
  const delayMinutes = Math.min(60, Math.pow(2, Math.max(0, attempts - 1)) * 2);
  return new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
}

function isPaused() {
  return circuit.pausedUntil > Date.now();
}

function recordSuccess() {
  circuit.failures = 0;
  circuit.pausedUntil = 0;
}

function recordFailure() {
  circuit.failures += 1;
  if (circuit.failures >= FAILURE_THRESHOLD) {
    circuit.pausedUntil = Date.now() + PAUSE_MS;
  }
}

export function notificationState(status = "pending", extra = {}) {
  return {
    status,
    attempts: 0,
    next_attempt_at: nowIso(),
    delivered_at: null,
    last_error: null,
    paused_until: null,
    ...extra,
  };
}

async function updateNotificationState(idempotencyKey, nextState) {
  if (!idempotencyKey) return;
  const supabase = getSupabaseAdminClient();
  const { data, error: lookupError } = await supabase
    .from("funnel_events")
    .select("id,event_data")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (lookupError || !data) {
    if (lookupError) console.warn("n8n notification state lookup failed:", lookupError.message);
    return;
  }

  const eventData = data.event_data && typeof data.event_data === "object" ? data.event_data : {};
  const current = eventData.notification && typeof eventData.notification === "object" ? eventData.notification : {};
  const { error } = await supabase
    .from("funnel_events")
    .update({ event_data: { ...eventData, notification: { ...current, ...nextState } } })
    .eq("id", data.id);

  if (error) console.warn("n8n notification state update failed:", error.message);
}

export async function sendToN8n(payload) {
  const webhookUrl = env.N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    const error = new Error("n8n webhook is not configured");
    error.code = "N8N_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Idempotency-Key": String(payload.idempotency_key || payload.event_id || ""),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    const error = new Error(`n8n returned ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return { skipped: false, status: response.status };
}

export async function deliverQueuedNotification(payload) {
  const idempotencyKey = payload.idempotency_key;
  const existing = payload.notification && typeof payload.notification === "object" ? payload.notification : {};
  const attempts = Number(existing.attempts || 0);

  if (existing.status === "delivered") return { delivered: false, skipped: "already_delivered" };

  if (isPaused()) {
    await updateNotificationState(idempotencyKey, {
      status: "paused",
      paused_until: new Date(circuit.pausedUntil).toISOString(),
      next_attempt_at: new Date(circuit.pausedUntil).toISOString(),
    });
    return { delivered: false, skipped: "paused" };
  }

  try {
    await updateNotificationState(idempotencyKey, {
      status: attempts ? "retry_pending" : "pending",
      attempts,
      last_attempt_at: nowIso(),
    });
    await sendToN8n(payload);
    recordSuccess();
    await updateNotificationState(idempotencyKey, {
      status: "delivered",
      attempts: attempts + 1,
      delivered_at: nowIso(),
      last_error: null,
      next_attempt_at: null,
      paused_until: null,
    });
    return { delivered: true };
  } catch (error) {
    recordFailure();
    const nextAttempts = attempts + 1;
    const terminal = nextAttempts >= MAX_RETRY_ATTEMPTS;
    const paused = isPaused();
    await updateNotificationState(idempotencyKey, {
      status: terminal ? "failed" : paused ? "paused" : "retry_pending",
      attempts: nextAttempts,
      last_error: sanitizedError(error),
      last_attempt_at: nowIso(),
      next_attempt_at: terminal ? null : paused ? new Date(circuit.pausedUntil).toISOString() : nextRetryAt(nextAttempts),
      paused_until: paused ? new Date(circuit.pausedUntil).toISOString() : null,
    });
    console.warn("n8n notification deferred:", {
      event_type: payload.event_type,
      idempotency_key: idempotencyKey,
      status: terminal ? "failed" : paused ? "paused" : "retry_pending",
      message: sanitizedError(error),
    });
    return { delivered: false, error };
  }
}

export function enqueueN8nNotification(payload) {
  setTimeout(() => {
    deliverQueuedNotification(payload).catch((error) => {
      console.warn("n8n async notification worker failed:", sanitizedError(error));
    });
  }, 0);
}

function notificationDue(notification) {
  if (!notification || notification.status === "delivered") return false;
  if (notification.status === "failed" && Number(notification.attempts || 0) >= MAX_RETRY_ATTEMPTS) return false;
  const nextAttempt = notification.next_attempt_at ? Date.parse(notification.next_attempt_at) : 0;
  return !nextAttempt || nextAttempt <= Date.now();
}

export async function processN8nNotificationRetries() {
  if (retryWorkerRunning) return;
  retryWorkerRunning = true;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("funnel_events")
      .select("event_type,event_data,idempotency_key,created_at")
      .in("event_type", ["conversation_summary_ready", "booking_offered", "booking_clicked", "booking_completed"])
      .order("created_at", { ascending: false })
      .limit(RETRY_LOOKBACK_LIMIT);

    if (error) {
      console.warn("n8n retry lookup failed:", error.message);
      return;
    }

    const retryable = (data || [])
      .map((row) => ({ ...row.event_data, event_type: row.event_type, idempotency_key: row.idempotency_key, notification: row.event_data?.notification }))
      .filter((payload) => notificationDue(payload.notification))
      .reverse()
      .slice(0, 10);

    for (const payload of retryable) {
      await deliverQueuedNotification(payload);
    }
  } finally {
    retryWorkerRunning = false;
  }
}

export function startN8nRetryWorker() {
  if (retryWorkerStarted) return;
  retryWorkerStarted = true;
  setInterval(() => {
    processN8nNotificationRetries().catch((error) => {
      console.warn("n8n retry worker failed:", sanitizedError(error));
    });
  }, RETRY_WORKER_INTERVAL_MS).unref?.();
}
