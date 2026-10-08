import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmForm } from "@/components/confirm-form";
import { formatPayrollMonth } from "@/lib/dates";
import { isUuid } from "@/lib/ids";
import { requireRole } from "@/server/auth/guard";
import { csrfTokenFromRequest } from "@/server/auth/request";
import { retryFailedEmail } from "@/server/email/actions";
import { batchStatusLabel, deliveryStatusLabel } from "@/server/email/labels";
import { getEmailBatchPage } from "@/server/email/queries";

export default async function EmailBatchPage({ params }: { params: Promise<{ periodId: string; batchId: string }> }) {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);
  const { periodId, batchId } = await params;
  if (!isUuid(periodId) || !isUuid(batchId)) notFound();
  const batch = await getEmailBatchPage(periodId, batchId);
  if (!batch) notFound();
  const csrf = await csrfTokenFromRequest();
  const month = formatPayrollMonth(batch.payrollPeriod.year, batch.payrollPeriod.month);

  return (
    <section className="rounded-[10px] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="px-4 py-4">
        <p className="text-[12.5px] text-muted">
          <Link href={`/payroll/${periodId}/email`} className="text-accent">{month}</Link>
        </p>
        <h1 className="mt-1 text-[21px] font-bold tracking-[-0.02em]">Email batch</h1>
        <p className="mt-1 text-[13px] text-muted">
          {batchStatusLabel(batch.status)} · {batch.sent} accepted by the mail server · {batch.failed} failed · {batch.pending} still queued
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-y border-border-soft bg-surface-2 text-[11.5px] font-semibold text-heading">
              <th className="px-4 py-2 font-semibold">Employee</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2 font-semibold">Attempts</th>
              <th className="px-4 py-2 font-semibold">Retry</th>
            </tr>
          </thead>
          <tbody>
            {batch.deliveries.map((delivery) => (
              <tr key={delivery.id} className="border-b border-border-soft align-top">
                <td className="px-4 py-3">
                  <Link href={`/payroll/${periodId}/${delivery.payrollRecordId}`} className="text-[13.5px] font-medium text-text">
                    {delivery.recipientName}
                  </Link>
                  <p className="text-[12.5px] text-muted">{delivery.recipientEmail}</p>
                  {delivery.lastErrorSanitized ? <p className="mt-1 text-[12.5px] text-negative">{delivery.lastErrorSanitized}</p> : null}
                </td>
                <td className="px-4 py-3 text-[12.5px] text-muted">{deliveryStatusLabel(delivery.status)}</td>
                <td className="px-4 py-3 font-mono text-[12.5px]">{delivery.attempts}</td>
                <td className="px-4 py-3">
                  {delivery.status === "FAILED" ? (
                    <ConfirmForm
                      csrf={csrf}
                      action={retryFailedEmail}
                      hidden={{ deliveryId: delivery.id }}
                      confirmLabel="Retry this failed email."
                      buttonLabel="Retry"
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
