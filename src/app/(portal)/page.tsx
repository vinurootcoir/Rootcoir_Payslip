import Link from "next/link";
import { requireUser } from "@/server/auth/guard";
import { parsePayslipYear } from "@/server/access/policy";
import { getStaffDashboard } from "@/server/dashboard/queries";
import { listOwnPayslips } from "@/server/me/queries";
import { mailIsConfigured } from "@/server/email/kick";
import { readSnapshot } from "@/server/payroll/snapshot";
import { formatMoney } from "@/lib/money";
import { formatPayrollMonth } from "@/lib/dates";
import { roleLabel } from "@/lib/roles";
import type { CurrentUser } from "@/server/auth/session";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const current = await requireUser();
  if (current.role === "USER") {
    const params = await searchParams;
    return <EmployeeHome current={current} year={parsePayslipYear(params.year)} />;
  }
  return <StaffHome current={current} />;
}

async function EmployeeHome({ current, year }: { current: CurrentUser; year: number | null }) {
  if (!current.employeeId) {
    return (
      <section className="max-w-3xl rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <h1 className="text-[21px] font-bold tracking-[-0.02em]">Payslips</h1>
        <p className="mt-2 text-[13.5px] text-muted">This login is not linked to an employee record.</p>
      </section>
    );
  }

  const { records, years } = await listOwnPayslips(current.employeeId, year);
  return (
    <section className="rounded-[10px] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[21px] font-bold tracking-[-0.02em]">Payslips</h1>
          <p className="text-[12.5px] text-muted">Finalized payslips for your employee record.</p>
        </div>
        <div className="flex w-fit flex-wrap gap-1 rounded-[8px] border border-border-soft bg-surface p-1">
          <YearLink href="/" active={year === null} label="All" />
          {years.map((item) => (
            <YearLink key={item} href={`/?year=${item}`} active={year === item} label={String(item)} />
          ))}
        </div>
      </div>
      {records.length === 0 ? (
        <p className="border-t border-border-soft px-4 py-10 text-[13.5px] text-muted">No payslips yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-y border-border-soft bg-surface-2 text-[11.5px] font-semibold text-heading">
                <th className="px-4 py-2 font-semibold">Month</th>
                <th className="px-4 py-2 font-semibold">Payslip</th>
                <th className="px-4 py-2 font-semibold">Net pay</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">PDF</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const snapshot = readSnapshot(record.snapshot);
                const net = snapshot ? formatMoney(snapshot.netPay, snapshot.company.currency) : "—";
                return (
                  <tr key={record.id} className="border-b border-border-soft">
                    <td className="px-4 py-3 text-[13.5px] text-text">{formatPayrollMonth(record.payrollPeriod.year, record.payrollPeriod.month)}</td>
                    <td className="px-4 py-3 font-mono text-[12.5px] text-text">
                      {snapshot?.payslipNumber ?? record.payslipNumber ?? "Payslip"}
                      {record.revision > 1 ? <span className="ml-2 text-muted">Rev {record.revision}</span> : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12.5px] text-text">{net}</td>
                    <td className="px-4 py-3 text-[12.5px] text-muted">{record.status === "VOID" ? "Void" : "Finalized"}</td>
                    <td className="px-4 py-3">
                      {snapshot ? (
                        <a className="text-[13px] font-medium text-accent" href={`/payroll/${record.payrollPeriod.id}/${record.id}/pdf`}>
                          Download
                        </a>
                      ) : (
                        <span className="text-[12.5px] text-muted">Unavailable</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function YearLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-[6px] px-2.5 py-1 text-[12.5px] ${
        active
          ? "bg-accent-soft font-medium text-accent shadow-[inset_0_-2px_0_0_var(--nav-indicator)]"
          : "text-faint hover:text-muted"
      }`}
    >
      {label}
    </Link>
  );
}

async function StaffHome({ current }: { current: CurrentUser }) {
  const dashboard = await getStaffDashboard();
  return (
    <div className="grid max-w-5xl gap-4">
      <section className="rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <h1 className="text-[21px] font-bold tracking-[-0.02em]">Dashboard</h1>
        <p className="mt-1 text-[13.5px] text-muted">
          Signed in as {current.email}. Your role is {roleLabel(current.role)}.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Draft periods" value={dashboard.draftPeriods} />
          <Stat label="Finalized periods" value={dashboard.finalizedPeriods} />
          <Stat label="Active employees" value={dashboard.activeEmployees} />
        </dl>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/payroll" className="inline-flex rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover">
            Payroll
          </Link>
          <Link href="/employees" className="inline-flex rounded-[8px] border border-border-accent bg-surface px-4 py-2.5 text-[13.5px] font-medium text-accent hover:bg-accent-soft">
            Employees
          </Link>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[10px] border border-border bg-surface shadow-[var(--shadow-card)]">
          <div className="px-4 py-4">
            <h2 className="text-[14.5px] font-bold">Payroll periods</h2>
          </div>
          {dashboard.periods.length === 0 ? (
            <p className="border-t border-border-soft px-4 py-8 text-[13.5px] text-muted">No payroll periods yet.</p>
          ) : (
            <ul className="border-t border-border-soft">
              {dashboard.periods.map((period) => (
                <li key={period.id} className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3">
                  <Link href={`/payroll/${period.id}`} className="text-[13.5px] font-medium text-text">
                    {formatPayrollMonth(period.year, period.month)}
                  </Link>
                  <span className="text-[12.5px] text-muted">{period.status === "FINALIZED" ? "Finalized" : "Draft"} · {period._count.records}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-[10px] border border-border bg-surface shadow-[var(--shadow-card)]">
          <div className="px-4 py-4">
            <h2 className="text-[14.5px] font-bold">Email batches</h2>
          </div>
          {dashboard.batches.length === 0 ? (
            <p className="border-t border-border-soft px-4 py-8 text-[13.5px] text-muted">No payslip email yet.</p>
          ) : (
            <ul className="border-t border-border-soft">
              {dashboard.batches.map((batch) => (
                <li key={batch.id} className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3">
                  <Link href={`/payroll/${batch.payrollPeriod.id}/email/${batch.id}`} className="text-[13.5px] font-medium text-text">
                    {formatPayrollMonth(batch.payrollPeriod.year, batch.payrollPeriod.month)}
                  </Link>
                  <span className="text-[12.5px] text-muted">{batch.sentCount} accepted · {batch.failedCount} failed</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {current.role === "SUPER_ADMIN" ? (
        <section className="rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-[14.5px] font-bold">System</h2>
          <p className="mt-2 text-[13.5px] text-muted">Mail server: {mailIsConfigured() ? "configured" : "not configured"}.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/settings/users" className="text-[13.5px] font-medium text-accent">Users</Link>
            <Link href="/settings/audit" className="text-[13.5px] font-medium text-accent">Audit log</Link>
            <Link href="/settings/company" className="text-[13.5px] font-medium text-accent">Company</Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] border border-border-soft bg-surface px-3 py-2">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="font-mono text-[18px] font-bold text-heading">{value}</dd>
    </div>
  );
}
