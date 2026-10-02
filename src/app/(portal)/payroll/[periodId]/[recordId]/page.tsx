import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmForm } from "@/components/confirm-form";
import { PayrollEntryForm } from "@/components/payroll-entry-form";
import { requireRole } from "@/server/auth/guard";
import { csrfTokenFromRequest } from "@/server/auth/request";
import { getCompanySettings } from "@/server/company/queries";
import { queuePeriodEmails, resendPayslipEmail } from "@/server/email/actions";
import { getRecordEmailState } from "@/server/email/queries";
import { deliveryStatusLabel } from "@/server/email/labels";
import { finalizeRevision, voidAndReissue } from "@/server/payroll/finalize";
import { getPayrollRecord } from "@/server/payroll/queries";
import { moneyInput } from "@/server/payroll/schema";
import { readSnapshot, type PayslipSnapshot } from "@/server/payroll/snapshot";
import { formatPayrollMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { isUuid } from "@/lib/ids";

export default async function PayrollEntryPage({
  params,
}: {
  params: Promise<{ periodId: string; recordId: string }>;
}) {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);
  const { periodId, recordId } = await params;
  if (!isUuid(periodId) || !isUuid(recordId)) notFound();
  const record = await getPayrollRecord(recordId);
  if (!record || record.payrollPeriod.id !== periodId) notFound();
  const [csrf, company, emailState] = await Promise.all([
    csrfTokenFromRequest(),
    getCompanySettings(),
    record.status === "DRAFT" ? Promise.resolve(null) : getRecordEmailState(periodId, record.id),
  ]);
  const snapshot = readSnapshot(record.snapshot);
  const title = snapshot?.employee.fullName ?? record.employee.fullName;
  const month = formatPayrollMonth(record.payrollPeriod.year, record.payrollPeriod.month);

  return (
    <div className="grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <p className="text-[12.5px] text-muted">
          <Link href={`/payroll/${periodId}`} className="text-accent">{month}</Link>
        </p>
        <h1 className="mt-1 text-[21px] font-bold tracking-[-0.02em]">{title}</h1>
        <p className="mt-1 font-mono text-[12.5px] text-muted">
          {snapshot?.payslipNumber ?? record.payslipNumber ?? "Draft"} · Revision {record.revision}
        </p>
        {record.status === "DRAFT" ? (
          <p className="mt-2 mb-5 text-[12.5px] text-muted">
            PAN {record.employee.pan ? "on file" : "not set"} · UAN {record.employee.uan ? "on file" : "not set"} · ESI{" "}
            {record.employee.esiNumber ? "on file" : "not set"}. These are copied when the payslip is finalized.
          </p>
        ) : (
          <div className="mb-5" />
        )}
        {record.status === "DRAFT" ? (
          <PayrollEntryForm
            csrf={csrf}
            recordId={record.id}
            includeBonus={company?.includeBonus ?? false}
            includeOvertime={company?.includeOvertime ?? false}
            defaults={{
              totalWorkingDays: record.totalWorkingDays.toFixed(2),
              paidDays: record.paidDays.toFixed(2),
              lopDays: record.lopDays.toFixed(2),
              basicSalary: record.basicSalary.toFixed(2),
              hra: record.hra.toFixed(2),
              specialAllowance: record.specialAllowance.toFixed(2),
              otherAllowances: record.otherAllowances.toFixed(2),
              overtime: moneyInput(record.overtime),
              bonus: moneyInput(record.bonus),
              employeePf: moneyInput(record.employeePf),
              employeeEsi: moneyInput(record.employeeEsi),
              professionalTax: moneyInput(record.professionalTax),
              tds: moneyInput(record.tds),
              salaryAdvance: moneyInput(record.salaryAdvance),
              otherDeductions: moneyInput(record.otherDeductions),
            }}
          />
        ) : (
          <FinalizedView
            snapshot={snapshot}
            currency={record.currency}
            gross={record.grossEarnings.toString()}
            deductions={record.totalDeductions.toString()}
            net={record.netPay.toString()}
            words={record.amountInWords}
            designation={record.employee.designation}
            department={record.employee.department}
            voidReason={record.voidReason}
          />
        )}
      </section>
      <div className="flex flex-col gap-4">
        {snapshot && record.status !== "DRAFT" ? (
          <a
            href={`/payroll/${periodId}/${record.id}/pdf`}
            className="inline-flex w-fit rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover"
          >
            Download PDF
          </a>
        ) : null}
        {emailState?.canSend ? (
          <section className="rounded-[10px] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
            <h2 className="mb-2 text-[14.5px] font-bold">Email payslip</h2>
            <p className="mb-3 text-[12.5px] text-muted">Sends only to {emailState.email}, the work email on the employee record.</p>
            <ConfirmForm
              csrf={csrf}
              action={queuePeriodEmails}
              hidden={{ periodId, recordId: record.id }}
              confirmLabel="Email this payslip."
              buttonLabel="Queue email"
            />
          </section>
        ) : null}
        {emailState?.canResend ? (
          <section className="rounded-[10px] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
            <h2 className="mb-2 text-[14.5px] font-bold">Email again</h2>
            <p className="mb-3 text-[12.5px] text-muted">Sends only to {emailState.email}. The earlier send stays in the batch history.</p>
            <ConfirmForm
              csrf={csrf}
              action={resendPayslipEmail}
              hidden={{ periodId, recordId: record.id }}
              confirmLabel="Email this payslip again."
              buttonLabel="Queue another email"
            />
          </section>
        ) : null}
        {emailState?.latest && !emailState.canSend && !emailState.canResend ? (
          <p className="text-[13px] text-muted">
            Email status: {deliveryStatusLabel(emailState.latest.status)}.{" "}
            <Link className="text-accent" href={`/payroll/${periodId}/email/${emailState.latest.batchId}`}>
              View batch
            </Link>
          </p>
        ) : null}
        {record.status === "DRAFT" && record.payrollPeriod.status === "FINALIZED" ? (
          <section className="rounded-[10px] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
            <h2 className="mb-2 text-[14.5px] font-bold">Finalize revision</h2>
            <p className="mb-3 text-[12.5px] text-muted">PAN, UAN, and ESI are copied from the employee record.</p>
            <ConfirmForm
              csrf={csrf}
              action={finalizeRevision}
              hidden={{ recordId: record.id }}
              confirmLabel="I confirm this revised payslip should be finalized."
              buttonLabel="Finalize revision"
            />
          </section>
        ) : null}
        {record.status === "FINALIZED" && record.supersededBy.length === 0 ? (
          <section className="rounded-[10px] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
            <h2 className="mb-2 text-[14.5px] font-bold">Void and reissue</h2>
            <p className="mb-3 text-[12.5px] text-muted">The finalized payslip stays in history. A new draft revision is opened.</p>
            <ConfirmForm
              csrf={csrf}
              action={voidAndReissue}
              hidden={{ recordId: record.id }}
              confirmLabel="I confirm this payslip should be voided and reissued."
              buttonLabel="Create revision"
              reason
            />
          </section>
        ) : null}
        {record.supersededBy[0] ? (
          <p className="text-[13px] text-muted">
            Replaced by{" "}
            <Link className="text-accent" href={`/payroll/${periodId}/${record.supersededBy[0].id}`}>
              revision {record.supersededBy[0].revision}
            </Link>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}

function FinalizedView({
  snapshot,
  currency,
  gross,
  deductions,
  net,
  words,
  designation,
  department,
  voidReason,
}: {
  snapshot: PayslipSnapshot | null;
  currency: string;
  gross: string;
  deductions: string;
  net: string;
  words: string | null;
  designation: string;
  department: string;
  voidReason: string | null;
}) {
  const moneyCurrency = snapshot?.company.currency ?? currency;
  const shownDesignation = snapshot?.employee.designation ?? designation;
  const shownDepartment = snapshot?.employee.department ?? department;
  const lines = snapshot
    ? [
        ["Total working days", snapshot.attendance.totalWorkingDays],
        ["Paid days", snapshot.attendance.paidDays],
        ["Absent / LOP days", snapshot.attendance.lopDays],
        ...(snapshot.attendance.casualLeaveDays ? [["Casual leave", snapshot.attendance.casualLeaveDays] as const] : []),
        ...(snapshot.attendance.sickLeaveDays ? [["Sick leave", snapshot.attendance.sickLeaveDays] as const] : []),
        ["Basic salary", formatMoney(snapshot.earnings.basicSalary, moneyCurrency)],
        ["HRA", formatMoney(snapshot.earnings.hra, moneyCurrency)],
        ["Special allowance", formatMoney(snapshot.earnings.specialAllowance, moneyCurrency)],
        ["Other allowances", formatMoney(snapshot.earnings.otherAllowances, moneyCurrency)],
        ...(snapshot.earnings.overtime ? [["Overtime", formatMoney(snapshot.earnings.overtime, moneyCurrency)] as const] : []),
        ...(snapshot.earnings.bonus ? [["Bonus / incentive", formatMoney(snapshot.earnings.bonus, moneyCurrency)] as const] : []),
        ...(snapshot.deductions.employeePf ? [["Employee PF", formatMoney(snapshot.deductions.employeePf, moneyCurrency)] as const] : []),
        ...(snapshot.deductions.employeeEsi ? [["Employee ESI", formatMoney(snapshot.deductions.employeeEsi, moneyCurrency)] as const] : []),
        ...(snapshot.deductions.professionalTax ? [["Professional tax", formatMoney(snapshot.deductions.professionalTax, moneyCurrency)] as const] : []),
        ...(snapshot.deductions.tds ? [["TDS", formatMoney(snapshot.deductions.tds, moneyCurrency)] as const] : []),
        ...(snapshot.deductions.salaryAdvance ? [["Salary advance / loan", formatMoney(snapshot.deductions.salaryAdvance, moneyCurrency)] as const] : []),
        ...(snapshot.deductions.otherDeductions ? [["Other deductions", formatMoney(snapshot.deductions.otherDeductions, moneyCurrency)] as const] : []),
      ]
    : [];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13.5px] text-muted">{shownDesignation} · {shownDepartment}</p>
      {snapshot ? (
        <p className="text-[12.5px] text-muted">
          {snapshot.company.name}
          {snapshot.employee.pan ? ` · PAN ${snapshot.employee.pan}` : ""}
          {snapshot.employee.uan ? ` · UAN ${snapshot.employee.uan}` : ""}
          {snapshot.employee.esiNumber ? ` · ESI ${snapshot.employee.esiNumber}` : ""}
        </p>
      ) : null}
      {voidReason ? <p className="rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">Voided: {voidReason}</p> : null}
      {lines.length > 0 ? (
        <dl className="grid gap-2 sm:grid-cols-2">
          {lines.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3 border-b border-border-soft py-1.5">
              <dt className="text-[12.5px] text-muted">{label}</dt>
              <dd className="font-mono text-[12.5px] text-text">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <dl className="grid gap-3 rounded-[10px] border border-border bg-surface-2 p-4 sm:grid-cols-3">
        <div>
          <dt className="text-[12px] text-muted">Gross earnings</dt>
          <dd className="font-mono text-[18px] font-bold">{formatMoney(snapshot?.earnings.grossEarnings ?? gross, moneyCurrency)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Total deductions</dt>
          <dd className="font-mono text-[18px] font-bold">{formatMoney(snapshot?.deductions.totalDeductions ?? deductions, moneyCurrency)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-muted">Net pay</dt>
          <dd className="font-mono text-[18px] font-bold">{formatMoney(snapshot?.netPay ?? net, moneyCurrency)}</dd>
        </div>
        <p className="sm:col-span-3 text-[13px] text-muted">{snapshot?.amountInWords ?? words}</p>
      </dl>
    </div>
  );
}
