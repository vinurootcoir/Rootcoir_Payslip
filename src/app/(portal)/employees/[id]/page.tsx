import Link from "next/link";
import { notFound } from "next/navigation";
import { AttendanceForm } from "@/components/attendance-form";
import { EmployeeForm } from "@/components/employee-form";
import { SalaryForm } from "@/components/salary-form";
import { StatusPill } from "@/components/status-pill";
import { requireRole } from "@/server/auth/guard";
import { csrfTokenFromRequest } from "@/server/auth/request";
import { getCompanySettings } from "@/server/company/queries";
import { formatDisplayDate, formatPayrollMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { employeeDefaults } from "@/server/employees/schema";
import { payslipAmounts, salaryFieldValues } from "@/server/employees/salary";
import { getEmployee, listEmployeePayroll } from "@/server/employees/queries";

const tabs = [
  { id: "profile", label: "Profile" },
  { id: "salary", label: "Salary" },
  { id: "attendance", label: "Attendance" },
  { id: "payslips", label: "Payslips" },
] as const;

type EmployeeTab = (typeof tabs)[number]["id"];

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);
  const { id } = await params;
  const query = await searchParams;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  const tab = currentTab(query.tab);
  const [employee, payslips, company, csrf] = await Promise.all([
    getEmployee(id),
    listEmployeePayroll(id),
    getCompanySettings(),
    csrfTokenFromRequest(),
  ]);
  if (!employee) notFound();

  const currency = company?.currency || "INR";
  const salary = salaryFieldValues(employee);
  const split = payslipAmounts(employee, currency);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <section className="rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[21px] font-bold tracking-[-0.02em]">{employee.fullName}</h1>
          <StatusPill status={employee.status} />
        </div>
        <p className="mt-1 font-mono text-[12.5px] text-muted">{employee.employeeNumber}</p>
        <p className="mt-1 text-[13.5px] text-text">
          {employee.designation} · {employee.department}
        </p>
        <p className="text-[13px] text-muted">{employee.workEmail}</p>
      </section>
      <nav className="flex w-fit flex-wrap gap-1 rounded-[8px] bg-surface-2 p-1">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={item.id === "profile" ? `/employees/${employee.id}` : `/employees/${employee.id}?tab=${item.id}`}
            className={`rounded-[6px] px-3 py-1.5 text-[13px] ${tab === item.id ? "bg-surface font-medium text-text shadow-[var(--shadow-card)]" : "text-muted"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {tab === "profile" ? (
        <section className="rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-[18px] font-bold tracking-[-0.02em]">Profile</h2>
          <dl className="mt-4 mb-5 grid gap-3 sm:grid-cols-2">
            <Detail label="Employee number" value={employee.employeeNumber} mono />
            <Detail label="Work email" value={employee.workEmail} />
            <Detail label="Phone" value={employee.phone || "—"} />
            <Detail label="Designation" value={employee.designation} />
            <Detail label="Department" value={employee.department} />
            <Detail label="Date of joining" value={formatDisplayDate(employee.dateOfJoining)} mono />
            <Detail label="Portal login" value={employee.user ? "Linked" : "Not linked"} />
          </dl>
          <EmployeeForm csrf={csrf} defaults={employeeDefaults(employee)} />
        </section>
      ) : null}
      {tab === "salary" ? (
        <section className="rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-[18px] font-bold tracking-[-0.02em]">Salary</h2>
          <p className="mt-1 text-[13px] text-muted">
            Enter the monthly amounts. Gross is basic, HRA, special allowance, and other allowances. Deductions are subtracted from that.
            These amounts are copied onto each new draft payslip. Saving also updates payslips that are still drafts. Finalized payslips stay as they were.
            Overtime, bonus, and one-off deductions are entered on the monthly payslip.
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <Detail label="Gross" value={formatMoney(split.grossEarnings, currency)} mono />
            <Detail label="Deductions" value={formatMoney(split.totalDeductions, currency)} mono />
            <Detail label="Net" value={formatMoney(split.netPay, currency)} mono />
          </dl>
          {split.errors.length > 0 ? <p className="mt-3 text-[13px] text-negative">{split.errors.join(" ")}</p> : null}
          <div className="mt-5">
            <SalaryForm csrf={csrf} defaults={{ id: employee.id, ...salary }} />
          </div>
        </section>
      ) : null}
      {tab === "attendance" ? (
        <section className="rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-[18px] font-bold tracking-[-0.02em]">Attendance</h2>
          <p className="mt-1 text-[13px] text-muted">
            Working days, paid days, absent days, casual leave, and sick leave are recorded for each month. Draft months can be edited here.
          </p>
          {payslips.length === 0 ? (
            <p className="mt-4 text-[13.5px] text-muted">No payroll months yet. Add this employee to a draft period first.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {payslips.map((record) => (
                <article key={record.id} className="rounded-[8px] border border-border-soft p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[14px] font-medium text-text">
                      {formatPayrollMonth(record.payrollPeriod.year, record.payrollPeriod.month)}
                    </p>
                    <span className="text-[12.5px] text-muted">{recordLabel(record.status)}</span>
                  </div>
                  {record.status === "DRAFT" ? (
                    <AttendanceForm
                      csrf={csrf}
                      recordId={record.id}
                      totalWorkingDays={record.totalWorkingDays.toFixed(2)}
                      paidDays={record.paidDays.toFixed(2)}
                      lopDays={record.lopDays.toFixed(2)}
                      casualLeaveDays={record.casualLeaveDays.toFixed(2)}
                      sickLeaveDays={record.sickLeaveDays.toFixed(2)}
                    />
                  ) : (
                    <p className="mt-2 font-mono text-[12.5px] text-muted">
                      Working {record.totalWorkingDays.toFixed(2)} · Paid {record.paidDays.toFixed(2)} · Absent {record.lopDays.toFixed(2)} · Casual{" "}
                      {record.casualLeaveDays.toFixed(2)} · Sick {record.sickLeaveDays.toFixed(2)}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
      {tab === "payslips" ? (
        <section className="rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-[18px] font-bold tracking-[-0.02em]">Payslips</h2>
          {payslips.length === 0 ? (
            <p className="mt-4 text-[13.5px] text-muted">No payslips yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <thead>
                  <tr className="border-y border-border-soft text-[11.5px] font-semibold text-faint">
                    <th className="px-2 py-2 font-semibold">Month</th>
                    <th className="px-2 py-2 font-semibold">Status</th>
                    <th className="px-2 py-2 font-semibold">Number</th>
                    <th className="px-2 py-2 text-right font-semibold">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((record) => (
                    <tr key={record.id} className="border-b border-border-soft">
                      <td className="px-2 py-3">
                        <Link href={`/payroll/${record.payrollPeriod.id}/${record.id}`} className="text-[13.5px] font-medium text-text">
                          {formatPayrollMonth(record.payrollPeriod.year, record.payrollPeriod.month)}
                        </Link>
                      </td>
                      <td className="px-2 py-3 text-[13px] text-muted">{recordLabel(record.status)}</td>
                      <td className="px-2 py-3 font-mono text-[12.5px] text-muted">{record.payslipNumber ?? "—"}</td>
                      <td className="px-2 py-3 text-right font-mono text-[12.5px] text-text">
                        {formatMoney(record.netPay.toString(), record.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function currentTab(value: string | undefined): EmployeeTab {
  return tabs.some((tab) => tab.id === value) ? (value as EmployeeTab) : "profile";
}

function recordLabel(status: string) {
  if (status === "FINALIZED") return "Finalized";
  if (status === "VOID") return "Void";
  return "Draft";
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11.5px] font-medium text-faint">{label}</dt>
      <dd className={`text-[13.5px] text-text ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
