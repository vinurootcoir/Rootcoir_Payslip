import type { PrismaClient } from "@prisma/client";
import { formatPayrollMonth } from "@/lib/dates";
import { renderPayslipPdf } from "@/server/payroll/pdf";
import { buildPayslipDocument } from "@/server/payroll/payslip-document";
import { readSnapshot } from "@/server/payroll/snapshot";
import { bindDeliveryMail, PermanentMailError, renderPayslipEmail } from "./message";
import { isSendable, isStaleExhausted, rollupBatchStatus } from "./outcome";
import type { ClaimedDelivery, EmailQueueAdapter } from "./process";
import { logFailure } from "@/lib/log";

const claimSelect = {
  id: true,
  batchId: true,
  payrollRecordId: true,
  recipientEmail: true,
  recipientName: true,
  attempts: true,
  status: true,
  updatedAt: true,
} as const;

async function rollup(db: PrismaClient, batchId: string): Promise<void> {
  const rows = await db.emailDelivery.groupBy({
    by: ["status"],
    where: { batchId },
    _count: { _all: true },
  });
  const count = (status: "QUEUED" | "SENDING" | "RETRYING" | "SENT" | "FAILED") =>
    rows.find((row) => row.status === status)?._count._all ?? 0;
  const sent = count("SENT");
  const failed = count("FAILED");
  const pending = count("QUEUED") + count("SENDING") + count("RETRYING");
  await db.emailBatch.update({
    where: { id: batchId },
    data: {
      sentCount: sent,
      failedCount: failed,
      status: rollupBatchStatus({ sent, failed, pending }),
    },
  });
}

export function createPrismaEmailAdapter(db: PrismaClient): EmailQueueAdapter {
  return {
    async failStale(now) {
      const rows = await db.emailDelivery.findMany({
        where: { status: "SENDING" },
        select: { id: true, batchId: true, status: true, attempts: true, updatedAt: true },
      });
      const stale = rows.filter((row) => isStaleExhausted(row, now));
      if (stale.length === 0) return;
      await db.emailDelivery.updateMany({
        where: { id: { in: stale.map((row) => row.id) }, status: "SENDING" },
        data: { status: "FAILED", lastErrorSanitized: "The send did not finish and was stopped after repeated attempts." },
      });
      for (const batchId of new Set(stale.map((row) => row.batchId))) {
        await rollup(db, batchId);
      }
    },

    async claim(limit, now) {
      const rows = await db.emailDelivery.findMany({
        where: { status: { in: ["QUEUED", "RETRYING", "SENDING"] } },
        orderBy: { createdAt: "asc" },
        take: 40,
        select: claimSelect,
      });
      const ready = rows.filter((row) => isSendable(row, now)).slice(0, limit);
      const claimed: ClaimedDelivery[] = [];
      for (const row of ready) {
        const updated = await db.emailDelivery.updateMany({
          where: { id: row.id, status: row.status },
          data: { status: "SENDING", attempts: { increment: 1 } },
        });
        if (updated.count !== 1) continue;
        claimed.push({
          id: row.id,
          batchId: row.batchId,
          payrollRecordId: row.payrollRecordId,
          recipientEmail: row.recipientEmail,
          recipientName: row.recipientName,
          attempts: row.attempts + 1,
        });
        if (claimed.length >= limit) break;
      }
      return claimed;
    },

    async loadMail(delivery) {
      const record = await db.payrollRecord.findUnique({
        where: { id: delivery.payrollRecordId },
        select: {
          status: true,
          revision: true,
          snapshot: true,
          payrollPeriod: { select: { year: true, month: true } },
        },
      });
      const snapshot = record ? readSnapshot(record.snapshot) : null;
      if (!record || record.status !== "FINALIZED" || !snapshot) {
        throw new PermanentMailError("The payslip is no longer finalized.");
      }
      const company = await db.companySettings.findUnique({
        where: { id: 1 },
        select: { emailSubjectTemplate: true, emailBodyTemplate: true, payslipTemplate: true },
      });
      const rendered = renderPayslipEmail({
        subjectTemplate: company?.emailSubjectTemplate ?? "",
        bodyTemplate: company?.emailBodyTemplate ?? "",
        companyName: snapshot.company.name,
        employeeName: delivery.recipientName,
        payrollMonth: formatPayrollMonth(record.payrollPeriod.year, record.payrollPeriod.month),
        payslipNumber: snapshot.payslipNumber,
      });
      const template = company?.payslipTemplate && company.payslipTemplate.byteLength > 8
        ? new Uint8Array(company.payslipTemplate)
        : null;
      const pdf = await renderPayslipPdf(
        buildPayslipDocument(snapshot, {
          year: record.payrollPeriod.year,
          month: record.payrollPeriod.month,
          revision: record.revision,
          status: "FINALIZED",
          voidReason: null,
        }),
        template,
      );
      return bindDeliveryMail(delivery, snapshot, pdf.bytes, rendered);
    },

    async finish(delivery, decision) {
      await db.emailDelivery.update({
        where: { id: delivery.id },
        data: {
          status: decision.status,
          lastErrorSanitized: decision.error,
          providerResponseSanitized: decision.response,
          sentAt: decision.status === "SENT" ? new Date() : null,
        },
      });
      await rollup(db, delivery.batchId);
      const batch = await db.emailBatch.findUnique({
        where: { id: delivery.batchId },
        select: { initiatedById: true },
      });
      try {
        await db.auditLog.create({
          data: {
            actorId: batch?.initiatedById,
            action: decision.status === "SENT" ? "email.sent" : decision.status === "FAILED" ? "email.failed" : "email.retrying",
            targetType: "email_delivery",
            targetId: delivery.id,
            requestId: crypto.randomUUID(),
            metadata: { status: decision.status },
          },
        });
      } catch (error) {
        logFailure("email.audit", error);
      }
    },
  };
}
