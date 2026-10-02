import { z } from "zod";

const emailSchema = z.string().trim().email().max(160);

export type DeliveryProgress = "QUEUED" | "SENDING" | "SENT" | "FAILED" | "RETRYING";

export type EmailCandidate = {
  payrollRecordId: string;
  recordStatus: "DRAFT" | "FINALIZED" | "VOID";
  employeeStatus: "ACTIVE" | "INACTIVE" | "SEPARATED";
  workEmail: string;
  fullName: string;
  deliveries: { status: DeliveryProgress }[];
};

export type SkipReason = "not_finalized" | "inactive" | "invalid_email" | "in_flight" | "already_sent" | "needs_retry";

export type PlannedDelivery = {
  payrollRecordId: string;
  email: string;
  name: string;
  idempotencyKey: string;
};

export type EmailPlan = {
  queue: PlannedDelivery[];
  skipped: { payrollRecordId: string; reason: SkipReason }[];
};

function normalizeEmail(value: string): string | null {
  const parsed = emailSchema.safeParse(value);
  if (!parsed.success) return null;
  const email = parsed.data.toLowerCase();
  if (email.includes(",") || email.includes(";")) return null;
  return email;
}

function blocker(candidate: EmailCandidate): SkipReason | null {
  if (candidate.recordStatus !== "FINALIZED") return "not_finalized";
  if (candidate.employeeStatus !== "ACTIVE") return "inactive";
  if (!normalizeEmail(candidate.workEmail)) return "invalid_email";
  if (candidate.deliveries.some((delivery) => delivery.status === "QUEUED" || delivery.status === "SENDING" || delivery.status === "RETRYING")) {
    return "in_flight";
  }
  if (candidate.deliveries.some((delivery) => delivery.status === "SENT")) return "already_sent";
  if (candidate.deliveries.some((delivery) => delivery.status === "FAILED")) return "needs_retry";
  return null;
}

export function planEmailBatch(candidates: EmailCandidate[], selection: { mode: "all" } | { mode: "ids"; ids: readonly string[] }): EmailPlan {
  const selected = selection.mode === "all" ? null : new Set(selection.ids);
  const queue: PlannedDelivery[] = [];
  const skipped: EmailPlan["skipped"] = [];

  for (const candidate of candidates) {
    if (selected && !selected.has(candidate.payrollRecordId)) continue;
    const reason = blocker(candidate);
    if (reason) {
      skipped.push({ payrollRecordId: candidate.payrollRecordId, reason });
      continue;
    }
    const email = normalizeEmail(candidate.workEmail);
    if (!email) continue;
    queue.push({
      payrollRecordId: candidate.payrollRecordId,
      email,
      name: candidate.fullName.trim(),
      idempotencyKey: `payslip:${candidate.payrollRecordId}`,
    });
  }

  return { queue, skipped };
}

export function planResend(candidate: EmailCandidate):
  | { ok: true; email: string; name: string; idempotencyKey: string }
  | { ok: false; reason: SkipReason | "not_sent" } {
  if (candidate.recordStatus !== "FINALIZED") return { ok: false, reason: "not_finalized" };
  if (candidate.employeeStatus !== "ACTIVE") return { ok: false, reason: "inactive" };
  const email = normalizeEmail(candidate.workEmail);
  if (!email) return { ok: false, reason: "invalid_email" };
  if (candidate.deliveries.some((delivery) => delivery.status === "QUEUED" || delivery.status === "SENDING" || delivery.status === "RETRYING")) {
    return { ok: false, reason: "in_flight" };
  }
  if (!candidate.deliveries.some((delivery) => delivery.status === "SENT")) return { ok: false, reason: "not_sent" };
  return {
    ok: true,
    email,
    name: candidate.fullName.trim(),
    idempotencyKey: `payslip:${candidate.payrollRecordId}:resend:${candidate.deliveries.length}`,
  };
}

export function summarizePlan(plan: EmailPlan): { queued: number; alreadySent: number; inFlight: number; needsRetry: number; ineligible: number } {
  const count = (reason: SkipReason) => plan.skipped.filter((item) => item.reason === reason).length;
  return {
    queued: plan.queue.length,
    alreadySent: count("already_sent"),
    inFlight: count("in_flight"),
    needsRetry: count("needs_retry"),
    ineligible: count("not_finalized") + count("inactive") + count("invalid_email"),
  };
}
