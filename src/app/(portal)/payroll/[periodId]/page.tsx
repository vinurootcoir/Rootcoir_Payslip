import Link from "next/link";
import { notFound } from "next/navigation";
import { AddEmployeeForm } from "@/components/add-employee-form";
import { ConfirmForm } from "@/components/confirm-form";
import { requireRole } from "@/server/auth/guard";
import { csrfTokenFromRequest } from "@/server/auth/request";
import { finalizePayrollPeriod } from "@/server/payroll/finalize";
import { employeesAvailableForPeriod, getPayrollPeriod } from "@/server/payroll/queries";
import { formatPayrollMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { isUuid } from "@/lib/ids";
import { readSnapshot } from "@/server/payroll/snapshot";

export default async function PayrollPeriodPage({ params }: { params: Promise<{ periodId: string }> }) {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);
  const { periodId } = await params;
  if (!isUuid(periodId)) notFound();
  const period = await getPayrollPeriod(periodId);
  if (!period) notFound();
  const [csrf, available] = await Promise.all([
    csrfTokenFromRequest(),
    period.status === "DRAFT" ? employeesAvailableForPeriod(period.id) : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-[10px] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="px-4 py-4">
          <h1 className="text-[21px] font-bold tracking-[-0.02em]">{formatPayrollMonth(period.year, period.month)}</h1>
          <p className="text-[12.5px] text-muted">{period.status === "FINALIZED" ? "Finalized" : "Draft"}</p>
        </div>
        {period.records.length === 0 ? (
          <p className="border-t border-border-soft px-4 py-10 text-[13.5px] text-muted">No payslips in this period yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-y border-border-soft bg-surface-2 text-[11.5px] font-semibold text-faint">
                  <th className="px-4 py-2 font-semibold">Employee</th>
                  <th className="px-4 py-2 font-semibold">Payslip</th>
                  <th className="px-4 py-2 font-semibold">Net pay</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {period.records.map((record) => {
                  const snapshot = readSnapshot(record.snapshot);
                  const name = snapshot?.employee.fullName ?? record.employee.fullName;
                  const employeeNumber = snapshot?.employee.employeeNumber ?? record.employee.employeeNumber;
                  const net = snapshot?.netPay ?? record.netPay.toString();
                  const currency = snapshot?.company.currency ?? record.currency;
                  return (
                  <tr key={record.id} className="border-b border-border-soft hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Link href={`/payroll/${period.id}/${record.id}`} className="text-[13.5px] font-medium text-text">
                        {name}
                      </Link>
                      <p className="font-mono text-[12px] text-muted">{employeeNumber}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12.5px] text-text">
                      {snapshot?.payslipNumber ?? record.payslipNumber ?? "Draft"}
                      {record.revision > 1 ? <span className="ml-2 text-muted">Rev {record.revision}</span> : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12.5px] text-text">{formatMoney(net, currency)}</td>
                    <td className="px-4 py-3 text-[12.5px] text-muted">{record.status === "FINALIZED" ? "Finalized" : record.status === "VOID" ? "Void" : "Draft"}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="flex flex-col gap-4">
        {period.status === "DRAFT" ? (
          <section className="rounded-[10px] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
            <h2 className="mb-3 text-[14.5px] font-bold">Add employee</h2>
            <AddEmployeeForm csrf={csrf} periodId={period.id} employees={available} />
          </section>
        ) : null}
        {period.status === "DRAFT" ? (
          <section className="rounded-[10px] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
            <h2 className="text-[14.5px] font-bold">Finalize period</h2>
            <p className="mt-1 mb-3 text-[12.5px] text-muted">
              This locks every draft payslip. Later changes to the employee or company will not rewrite them.
            </p>
            <ConfirmForm
              csrf={csrf}
              action={finalizePayrollPeriod}
              hidden={{ periodId: period.id }}
              confirmLabel="I confirm this payroll period should be finalized."
              buttonLabel="Finalize period"
            />
          </section>
        ) : (
          <section className="rounded-[10px] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
            <h2 className="text-[14.5px] font-bold">Email payslips</h2>
            <p className="mt-1 mb-3 text-[12.5px] text-muted">Send finalized payslips to the work email stored on each employee.</p>
            <Link href={`/payroll/${period.id}/email`} className="text-[13.5px] font-medium text-accent">
              Review and send
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
