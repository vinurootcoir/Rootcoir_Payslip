import "server-only";
import { Prisma } from "@prisma/client";
import { isEmailActionRateLimited, recordEmailAction } from "@/server/auth/rate-limit";
import { getDb } from "@/server/db";
import { planEmailBatch, planResend, summarizePlan, type EmailCandidate } from "./plan";

type Row = {
  id: string;
  status: "DRAFT" | "FINALIZED" | "VOID";
  employee: { fullName: string; workEmail: string; status: "ACTIVE" | "INACTIVE" | "SEPARATED" };
  emailDeliveries: { status: EmailCandidate["deliveries"][number]["status"] }[];
};

function toCandidate(row: Row): EmailCandidate {
  return {
    payrollRecordId: row.id,
    recordStatus: row.status,
    employeeStatus: row.employee.status,
    workEmail: row.employee.workEmail,
    fullName: row.employee.fullName,
    deliveries: row.emailDeliveries,
  };
}

const recordSelect = {
  id: true,
  status: true,
  employee: { select: { fullName: true, workEmail: true, status: true } },
  emailDeliveries: { select: { status: true } },
} as const;

function emptyMessage(plan: ReturnType<typeof planEmailBatch>): string {
  const summary = summarizePlan(plan);
  if (summary.needsRetry > 0 && summary.queued === 0) return "Failed emails stay on their batch until you retry them.";
  if (summary.inFlight > 0) return "Those payslips are already queued.";
  if (summary.alreadySent > 0) return "Those payslips were already emailed. Open a payslip to send it again.";
  return "No active employee with a finalized payslip and a valid work email is waiting.";
}

async function createBatch(
  actorId: string,
  periodId: string,
  queue: { payrollRecordId: string; email: string; name: string; idempotencyKey: string }[],
): Promise<{ batchId: string }> {
  const batch = await getDb().$transaction(async (tx) => {
    const created = await tx.emailBatch.create({
      data: {
        payrollPeriodId: periodId,
        initiatedById: actorId,
        status: "QUEUED",
        totalCount: queue.length,
      },
      select: { id: true },
    });
    await tx.emailDelivery.createMany({
      data: queue.map((item) => ({
        batchId: created.id,
        payrollRecordId: item.payrollRecordId,
        recipientEmail: item.email,
        recipientName: item.name,
        idempotencyKey: item.idempotencyKey,
        status: "QUEUED" as const,
      })),
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "email.batch",
        targetType: "email_batch",
        targetId: created.id,
        requestId: crypto.randomUUID(),
        metadata: { count: queue.length },
      },
    });
    return created;
  });
  return { batchId: batch.id };
}

export async function enqueuePayslips(
  actorId: string,
  periodId: string,
  selection: { mode: "all" } | { mode: "ids"; ids: readonly string[] },
): Promise<{ batchId: string } | { error: string }> {
  if (await isEmailActionRateLimited(actorId)) return { error: "Too many email batches. Try again later." };
  try {
    const period = await getDb().payrollPeriod.findUnique({ where: { id: periodId }, select: { status: true } });
    if (!period || period.status !== "FINALIZED") return { error: "Finalize the payroll period before emailing payslips." };
    const rows = await getDb().payrollRecord.findMany({ where: { payrollPeriodId: periodId }, select: recordSelect });
    const plan = planEmailBatch(rows.map(toCandidate), selection);
    if (plan.queue.length === 0) return { error: emptyMessage(plan) };
    const created = await createBatch(actorId, periodId, plan.queue);
    await recordEmailAction(actorId);
    return created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Those payslips are already queued." };
    }
    throw error;
  }
}

export async function enqueueResend(
  actorId: string,
  periodId: string,
  recordId: string,
): Promise<{ batchId: string } | { error: string }> {
  if (await isEmailActionRateLimited(actorId)) return { error: "Too many email batches. Try again later." };
  try {
    const row = await getDb().payrollRecord.findFirst({
      where: { id: recordId, payrollPeriodId: periodId },
      select: recordSelect,
    });
    if (!row) return { error: "Payslip not found." };
    const planned = planResend(toCandidate(row));
    if (!planned.ok) {
      if (planned.reason === "in_flight") return { error: "That payslip email is already queued." };
      if (planned.reason === "not_sent") return { error: "Send the payslip before sending it again." };
      return { error: "That payslip cannot be emailed." };
    }
    const created = await createBatch(actorId, periodId, [
      {
        payrollRecordId: row.id,
        email: planned.email,
        name: planned.name,
        idempotencyKey: planned.idempotencyKey,
      },
    ]);
    await recordEmailAction(actorId);
    return created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "That payslip email is already queued." };
    }
    throw error;
  }
}

export async function requeueFailedDelivery(
  actorId: string,
  deliveryId: string,
): Promise<{ error: string | null; periodId: string | null; batchId: string | null }> {
  const delivery = await getDb().emailDelivery.findUnique({
    where: { id: deliveryId },
    select: { id: true, status: true, batchId: true, batch: { select: { payrollPeriodId: true } } },
  });
  if (await isEmailActionRateLimited(actorId)) {
    return { error: "Too many email batches. Try again later.", periodId: null, batchId: null };
  }
  if (!delivery || delivery.status !== "FAILED") {
    return { error: "That email is not waiting for a retry.", periodId: delivery?.batch.payrollPeriodId ?? null, batchId: delivery?.batchId ?? null };
  }
  const updated = await getDb().emailDelivery.updateMany({
    where: { id: delivery.id, status: "FAILED" },
    data: { status: "QUEUED", attempts: 0 },
  });
  if (updated.count !== 1) return { error: "That email is not waiting for a retry.", periodId: delivery.batch.payrollPeriodId, batchId: delivery.batchId };
  await getDb().auditLog.create({
    data: {
      actorId,
      action: "email.retry",
      targetType: "email_delivery",
      targetId: delivery.id,
      requestId: crypto.randomUUID(),
      metadata: { status: "QUEUED" },
    },
  });
  await recordEmailAction(actorId);
  return { error: null, periodId: delivery.batch.payrollPeriodId, batchId: delivery.batchId };
}
