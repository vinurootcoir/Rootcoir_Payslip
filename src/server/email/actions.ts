"use server";

import { logFailure } from "@/lib/log";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { isUuid } from "@/lib/ids";
import { requireRole } from "@/server/auth/guard";
import { mutationGuard } from "@/server/auth/request";
import { enqueuePayslips, enqueueResend, requeueFailedDelivery } from "./enqueue";
import { kickEmailQueue, mailIsConfigured } from "./kick";

const staff = ["SUPER_ADMIN", "ADMIN"] as const;

export type EmailFormState = { error: string | null; details: string[] };

function smtpMissing(): EmailFormState | null {
  if (mailIsConfigured()) return null;
  return {
    error: "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, and SMTP_SECURE, then restart the app.",
    details: [],
  };
}

export async function queuePeriodEmails(_state: EmailFormState, formData: FormData): Promise<EmailFormState> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { error: blocked, details: [] };
  const actor = await requireRole(staff);
  const smtpError = smtpMissing();
  if (smtpError) return smtpError;
  if (formData.get("confirm") !== "on") return { error: "Confirm that these payslips should be emailed.", details: [] };
  const periodId = String(formData.get("periodId") ?? "");
  if (!isUuid(periodId)) return { error: "Payroll period not found.", details: [] };
  const selection =
    formData.get("mode") === "all"
      ? { mode: "all" as const }
      : { mode: "ids" as const, ids: formData.getAll("recordId").map(String).filter(isUuid) };
  if (selection.mode === "ids" && selection.ids.length === 0) return { error: "Choose at least one employee.", details: [] };

  try {
    const result = await enqueuePayslips(actor.id, periodId, selection);
    if ("error" in result) return { error: result.error, details: [] };
    await kickEmailQueue();
    revalidatePath(`/payroll/${periodId}/email`);
    redirect(`/payroll/${periodId}/email/${result.batchId}`);
  } catch (error) {
    unstable_rethrow(error);
    logFailure("email.batch", error);
    return { error: "Something went wrong. Try again.", details: [] };
  }
}

export async function resendPayslipEmail(_state: EmailFormState, formData: FormData): Promise<EmailFormState> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { error: blocked, details: [] };
  const actor = await requireRole(staff);
  const smtpError = smtpMissing();
  if (smtpError) return smtpError;
  if (formData.get("confirm") !== "on") return { error: "Confirm that this payslip should be emailed again.", details: [] };
  const periodId = String(formData.get("periodId") ?? "");
  const recordId = String(formData.get("recordId") ?? "");
  if (!isUuid(periodId) || !isUuid(recordId)) return { error: "Payslip not found.", details: [] };

  try {
    const result = await enqueueResend(actor.id, periodId, recordId);
    if ("error" in result) return { error: result.error, details: [] };
    await kickEmailQueue();
    revalidatePath(`/payroll/${periodId}/email`);
    redirect(`/payroll/${periodId}/email/${result.batchId}`);
  } catch (error) {
    unstable_rethrow(error);
    logFailure("email.resend", error);
    return { error: "Something went wrong. Try again.", details: [] };
  }
}

export async function retryFailedEmail(_state: EmailFormState, formData: FormData): Promise<EmailFormState> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { error: blocked, details: [] };
  const actor = await requireRole(staff);
  const smtpError = smtpMissing();
  if (smtpError) return smtpError;
  if (formData.get("confirm") !== "on") return { error: "Confirm that this failed email should be retried.", details: [] };
  const deliveryId = String(formData.get("deliveryId") ?? "");
  if (!isUuid(deliveryId)) return { error: "Email delivery not found.", details: [] };

  try {
    const result = await requeueFailedDelivery(actor.id, deliveryId);
    if (result.periodId && result.batchId) revalidatePath(`/payroll/${result.periodId}/email/${result.batchId}`);
    if (result.error) return { error: result.error, details: [] };
    await kickEmailQueue();
    return { error: null, details: [] };
  } catch (error) {
    unstable_rethrow(error);
    logFailure("email.retry", error);
    return { error: "Something went wrong. Try again.", details: [] };
  }
}
