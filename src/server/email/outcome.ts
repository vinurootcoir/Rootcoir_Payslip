export const EMAIL_CHUNK_LIMIT = 10;
export const MAX_EMAIL_ATTEMPTS = 5;
export const STALE_SENDING_MS = 10 * 60 * 1000;

export function cappedChunkLimit(requested: number): number {
  if (!Number.isInteger(requested) || requested < 1) return 1;
  return Math.min(requested, EMAIL_CHUNK_LIMIT);
}

export function retryDelayMs(attempts: number): number {
  const seconds = Math.min(60 * 2 ** Math.max(0, attempts - 1), 30 * 60);
  return seconds * 1000;
}

export function sanitizeMailText(message: string, max = 300): string {
  const cleaned = message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return cleaned || "Mail could not be sent.";
}

export function isSendable(
  delivery: { status: "QUEUED" | "SENDING" | "SENT" | "FAILED" | "RETRYING"; attempts: number; updatedAt: Date },
  now: Date,
): boolean {
  if (delivery.status === "QUEUED") return true;
  const age = now.getTime() - delivery.updatedAt.getTime();
  if (delivery.status === "SENDING") {
    return delivery.attempts < MAX_EMAIL_ATTEMPTS && age >= STALE_SENDING_MS;
  }
  if (delivery.status === "RETRYING") {
    return delivery.attempts < MAX_EMAIL_ATTEMPTS && age >= retryDelayMs(delivery.attempts);
  }
  return false;
}

export function isStaleExhausted(
  delivery: { status: "QUEUED" | "SENDING" | "SENT" | "FAILED" | "RETRYING"; attempts: number; updatedAt: Date },
  now: Date,
): boolean {
  return (
    delivery.status === "SENDING" &&
    delivery.attempts >= MAX_EMAIL_ATTEMPTS &&
    now.getTime() - delivery.updatedAt.getTime() >= STALE_SENDING_MS
  );
}

export type SendResult =
  | { ok: true; response: string }
  | { ok: false; kind: "transient" | "permanent" | "configuration"; message: string };

export function classifyMailError(error: unknown): { kind: "transient" | "permanent" | "configuration"; message: string } {
  const responseCode =
    typeof error === "object" && error && "responseCode" in error ? Number((error as { responseCode: unknown }).responseCode) : Number.NaN;
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  const raw = error instanceof Error ? error.message : "Mail could not be sent.";
  if (code === "EAUTH" || responseCode === 535 || responseCode === 534) {
    return { kind: "configuration", message: "Mail server rejected the login." };
  }
  if (
    code === "ETIMEDOUT" ||
    code === "ECONNECTION" ||
    code === "ESOCKET" ||
    code === "ECONNRESET" ||
    (responseCode >= 400 && responseCode < 500)
  ) {
    return { kind: "transient", message: sanitizeMailText(raw) };
  }
  if (responseCode >= 500) return { kind: "permanent", message: sanitizeMailText(raw) };
  if (code) return { kind: "transient", message: sanitizeMailText(raw) };
  return { kind: "permanent", message: sanitizeMailText(raw) };
}

export function decideDeliveryOutcome(
  attempts: number,
  result: SendResult,
): { status: "SENT" | "FAILED" | "RETRYING"; stop: boolean; error: string | null; response: string | null } {
  if (result.ok) {
    return { status: "SENT", stop: false, error: null, response: sanitizeMailText(result.response, 200) };
  }
  if (result.kind === "permanent") {
    return { status: "FAILED", stop: false, error: result.message, response: null };
  }
  const status = attempts >= MAX_EMAIL_ATTEMPTS ? "FAILED" : "RETRYING";
  return { status, stop: result.kind === "configuration", error: result.message, response: null };
}

export function rollupBatchStatus(counts: { sent: number; failed: number; pending: number }): "QUEUED" | "PROCESSING" | "COMPLETED" | "COMPLETED_WITH_ERRORS" | "FAILED" {
  if (counts.pending > 0) return counts.sent + counts.failed > 0 ? "PROCESSING" : "QUEUED";
  if (counts.failed === 0) return "COMPLETED";
  if (counts.sent === 0) return "FAILED";
  return "COMPLETED_WITH_ERRORS";
}
