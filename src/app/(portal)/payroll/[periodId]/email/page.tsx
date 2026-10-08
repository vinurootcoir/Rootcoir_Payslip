import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmForm } from "@/components/confirm-form";
import { EmailSelectedForm } from "@/components/email-selected-form";
import { formatPayrollMonth } from "@/lib/dates";
import { isUuid } from "@/lib/ids";
import { requireRole } from "@/server/auth/guard";
import { csrfTokenFromRequest } from "@/server/auth/request";
import { queuePeriodEmails } from "@/server/email/actions";
import { batchStatusLabel } from "@/server/email/labels";
import { mailIsConfigured } from "@/server/email/kick";
import { getPeriodEmailOverview } from "@/server/email/queries";

export default async function PayrollEmailPage({ params }: { params: Promise<{ periodId: string }> }) {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);
  const { periodId } = await params;
  if (!isUuid(periodId)) notFound();
  const overview = await getPeriodEmailOverview(periodId);
  if (!overview) notFound();
  const csrf = await csrfTokenFromRequest();
  const month = formatPayrollMonth(overview.period.year, overview.period.month);

  return (
    <div className="grid max-w-5xl gap-4">
      <section className="rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <p className="text-[12.5px] text-muted">
          <Link href={`/payroll/${periodId}`} className="text-accent">{month}</Link>
        </p>
        <h1 className="mt-1 text-[21px] font-bold tracking-[-0.02em]">Email payslips</h1>
        <p className="mt-2 text-[13.5px] text-muted">
          Messages go one at a time to the work email on the employee record. Salary figures stay in the attached PDF.
        </p>
        {mailIsConfigured() ? null : (
          <p className="mt-3 rounded-[8px] bg-warn-soft px-3 py-2 text-[13px] text-warn">
            Mail is not configured yet. You can queue batches, then send them with the email worker after SMTP is set.
          </p>
        )}
        {overview.period.status !== "FINALIZED" ? (
          <p className="mt-4 text-[13.5px] text-muted">Finalize this period before emailing payslips.</p>
        ) : (
          <>
            <p className="mt-3 text-[12.5px] text-muted">Inactive employees, drafts, voided payslips, and invalid work emails are left out.</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-4">
              <Count label="Ready to send" value={overview.summary.queued} />
              <Count label="Already sent" value={overview.summary.alreadySent} />
              <Count label="Queued now" value={overview.summary.inFlight} />
              <Count label="Need a retry" value={overview.summary.needsRetry} />
            </dl>
          </>
        )}
      </section>
      {overview.period.status === "FINALIZED" && overview.queueable.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-[10px] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
            <h2 className="mb-2 text-[14.5px] font-bold">All eligible</h2>
            <p className="mb-3 text-[12.5px] text-muted">{overview.summary.queued} payslips will be queued. People who were already emailed are left out.</p>
            <ConfirmForm
              csrf={csrf}
              action={queuePeriodEmails}
              hidden={{ periodId, mode: "all" }}
              confirmLabel={`Email all ${overview.summary.queued} eligible payslips.`}
              buttonLabel="Queue all eligible"
            />
          </section>
          <section className="rounded-[10px] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
            <h2 className="mb-2 text-[14.5px] font-bold">Selected people</h2>
            <EmailSelectedForm csrf={csrf} periodId={periodId} rows={overview.queueable} />
          </section>
        </div>
      ) : null}
      <section className="rounded-[10px] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="px-4 py-4">
          <h2 className="text-[14.5px] font-bold">Batches</h2>
        </div>
        {overview.batches.length === 0 ? (
          <p className="border-t border-border-soft px-4 py-8 text-[13.5px] text-muted">No email batches yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-y border-border-soft bg-surface-2 text-[11.5px] font-semibold text-heading">
                  <th className="px-4 py-2 font-semibold">Queued</th>
                  <th className="px-4 py-2 font-semibold">Accepted</th>
                  <th className="px-4 py-2 font-semibold">Failed</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {overview.batches.map((batch) => (
                  <tr key={batch.id} className="border-b border-border-soft hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Link href={`/payroll/${periodId}/email/${batch.id}`} className="font-mono text-[12.5px] text-text">
                        {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(batch.createdAt)} UTC
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12.5px]">{batch.sent}/{batch.total}</td>
                    <td className="px-4 py-3 font-mono text-[12.5px]">{batch.failed}</td>
                    <td className="px-4 py-3 text-[12.5px] text-muted">{batchStatusLabel(batch.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] border border-border-soft px-3 py-2">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="font-mono text-[18px] font-bold">{value}</dd>
    </div>
  );
}
