import "server-only";
import { getDb } from "@/server/db";
import { planEmailBatch, planResend, summarizePlan, type EmailCandidate } from "./plan";
import { rollupBatchStatus } from "./outcome";

const recordSelect = {
  id: true,
  status: true,
  payslipNumber: true,
  employee: { select: { fullName: true, workEmail: true, status: true } },
  emailDeliveries: {
    orderBy: { createdAt: "desc" as const },
    select: { id: true, status: true, batchId: true, lastErrorSanitized: true },
  },
};

export async function getPeriodEmailOverview(periodId: string) {
  const period = await getDb().payrollPeriod.findUnique({
    where: { id: periodId },
    select: {
      id: true,
      year: true,
      month: true,
      status: true,
      emailBatches: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          deliveries: { select: { status: true } },
        },
      },
    },
  });
  if (!period) return null;
  const rows = await getDb().payrollRecord.findMany({
    where: { payrollPeriodId: periodId },
    orderBy: { employee: { fullName: "asc" } },
    select: recordSelect,
  });
  const candidates: EmailCandidate[] = rows.map((row) => ({
    payrollRecordId: row.id,
    recordStatus: row.status,
    employeeStatus: row.employee.status,
    workEmail: row.employee.workEmail,
    fullName: row.employee.fullName,
    deliveries: row.emailDeliveries.map((delivery) => ({ status: delivery.status })),
  }));
  const plan = planEmailBatch(candidates, { mode: "all" });
  return {
    period: { id: period.id, year: period.year, month: period.month, status: period.status },
    summary: summarizePlan(plan),
    queueable: plan.queue.map((item) => {
      const row = rows.find((record) => record.id === item.payrollRecordId);
      return {
        id: item.payrollRecordId,
        fullName: item.name,
        email: item.email,
        payslipNumber: row?.payslipNumber ?? null,
      };
    }),
    batches: period.emailBatches.map((batch) => {
      const sent = batch.deliveries.filter((delivery) => delivery.status === "SENT").length;
      const failed = batch.deliveries.filter((delivery) => delivery.status === "FAILED").length;
      const pending = batch.deliveries.length - sent - failed;
      return {
        id: batch.id,
        createdAt: batch.createdAt,
        total: batch.deliveries.length,
        sent,
        failed,
        status: rollupBatchStatus({ sent, failed, pending }),
      };
    }),
  };
}

export async function getEmailBatchPage(periodId: string, batchId: string) {
  const batch = await getDb().emailBatch.findFirst({
    where: { id: batchId, payrollPeriodId: periodId },
    select: {
      id: true,
      createdAt: true,
      payrollPeriod: { select: { year: true, month: true } },
      deliveries: {
        orderBy: { recipientName: "asc" },
        select: {
          id: true,
          recipientName: true,
          recipientEmail: true,
          status: true,
          attempts: true,
          lastErrorSanitized: true,
          sentAt: true,
          payrollRecordId: true,
        },
      },
    },
  });
  if (!batch) return null;
  const sent = batch.deliveries.filter((delivery) => delivery.status === "SENT").length;
  const failed = batch.deliveries.filter((delivery) => delivery.status === "FAILED").length;
  const pending = batch.deliveries.length - sent - failed;
  return {
    ...batch,
    sent,
    failed,
    pending,
    status: rollupBatchStatus({ sent, failed, pending }),
  };
}

export async function getRecordEmailState(periodId: string, recordId: string) {
  const row = await getDb().payrollRecord.findFirst({
    where: { id: recordId, payrollPeriodId: periodId },
    select: recordSelect,
  });
  if (!row) return null;
  const candidate: EmailCandidate = {
    payrollRecordId: row.id,
    recordStatus: row.status,
    employeeStatus: row.employee.status,
    workEmail: row.employee.workEmail,
    fullName: row.employee.fullName,
    deliveries: row.emailDeliveries.map((delivery) => ({ status: delivery.status })),
  };
  const plan = planEmailBatch([candidate], { mode: "ids", ids: [row.id] });
  const resend = planResend(candidate);
  const latest = row.emailDeliveries[0] ?? null;
  return {
    email: plan.queue[0]?.email ?? (resend.ok ? resend.email : null),
    canSend: plan.queue.length === 1,
    canResend: resend.ok,
    latest,
  };
}
