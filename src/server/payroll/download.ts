import "server-only";
import { getCurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { isUuid } from "@/lib/ids";
import { canDownloadPayslip } from "./pdf-access";
import { renderPayslipPdf } from "./pdf";
import { buildPayslipDocument } from "./payslip-document";
import { readSnapshot } from "./snapshot";

export async function loadPayslipPdf(
  periodId: string,
  recordId: string,
): Promise<{ bytes: Buffer; filename: string } | null> {
  if (!isUuid(periodId) || !isUuid(recordId)) return null;
  const actor = await getCurrentUser();
  if (!actor) return null;
  const record = await getDb().payrollRecord.findUnique({
    where: { id: recordId },
    select: {
      id: true,
      employeeId: true,
      status: true,
      revision: true,
      voidReason: true,
      snapshot: true,
      payrollPeriod: { select: { id: true, year: true, month: true } },
    },
  });
  if (!record || record.payrollPeriod.id !== periodId) return null;
  if (record.status === "DRAFT") return null;
  const snapshot = readSnapshot(record.snapshot);
  if (!snapshot) return null;
  if (!canDownloadPayslip(actor, { employeeId: record.employeeId, status: record.status })) return null;

  const document = buildPayslipDocument(snapshot, {
    year: record.payrollPeriod.year,
    month: record.payrollPeriod.month,
    revision: record.revision,
    status: record.status,
    voidReason: record.voidReason,
  });
  const rendered = await renderPayslipPdf(document);
  await getDb().auditLog.create({
    data: {
      actorId: actor.id,
      action: "payroll.pdf",
      targetType: "payroll_record",
      targetId: record.id,
      requestId: crypto.randomUUID(),
      metadata: { payslipNumber: document.payslipNumber },
    },
  });
  return { bytes: rendered.bytes, filename: document.filename };
}
