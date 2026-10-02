import Link from "next/link";
import { requireRole } from "@/server/auth/guard";
import { csrfTokenFromRequest } from "@/server/auth/request";
import { listPayrollPeriods } from "@/server/payroll/queries";
import { formatPayrollMonth } from "@/lib/dates";
import { PeriodCreateForm } from "@/components/period-create-form";

export default async function PayrollPeriodsPage() {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);
  const [csrf, periods] = await Promise.all([csrfTokenFromRequest(), listPayrollPeriods()]);
  const now = new Date();

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-[10px] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="px-4 py-4">
          <h1 className="text-[21px] font-bold tracking-[-0.02em]">Payroll periods</h1>
          <p className="text-[12.5px] text-muted">
            A new month starts empty and stays Draft until you finalize it. Draft payslips can still be edited.
          </p>
        </div>
        {periods.length === 0 ? (
          <p className="border-t border-border-soft px-4 py-10 text-[13.5px] text-muted">No payroll periods yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="border-y border-border-soft bg-surface-2 text-[11.5px] font-semibold text-faint">
                  <th className="px-4 py-2 font-semibold">Month</th>
                  <th className="px-4 py-2 font-semibold">Payslips</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period.id} className="border-b border-border-soft hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Link href={`/payroll/${period.id}`} className="text-[13.5px] font-medium text-text">
                        {formatPayrollMonth(period.year, period.month)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12.5px] text-text">{period._count.records}</td>
                    <td className="px-4 py-3">
                      <PeriodStatus status={period.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="flex flex-col gap-4">
        <section className="h-fit rounded-[10px] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <h2 className="text-[14.5px] font-bold">New period</h2>
          <p className="mt-1 text-[12.5px] text-muted">Create the month first, then choose employees on the next page.</p>
          <PeriodCreateForm csrf={csrf} year={now.getFullYear()} month={now.getMonth() + 1} />
        </section>
      </div>
    </div>
  );
}

function PeriodStatus({ status }: { status: "DRAFT" | "FINALIZED" }) {
  const styles = status === "FINALIZED" ? "bg-positive-soft text-positive" : "bg-warn-soft text-warn";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium ${styles}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {status === "FINALIZED" ? "Finalized" : "Draft"}
    </span>
  );
}
