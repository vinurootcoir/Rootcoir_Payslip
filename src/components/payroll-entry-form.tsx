"use client";

import { useActionState } from "react";
import { savePayrollEntry, type PayrollFormState } from "@/server/payroll/actions";

const initialState: PayrollFormState = { error: null, saved: false, warnings: [], preview: null };

type Defaults = {
  totalWorkingDays: string;
  paidDays: string;
  lopDays: string;
  basicSalary: string;
  hra: string;
  specialAllowance: string;
  otherAllowances: string;
  overtime: string;
  bonus: string;
  employeePf: string;
  employeeEsi: string;
  professionalTax: string;
  tds: string;
  salaryAdvance: string;
  otherDeductions: string;
};

export function PayrollEntryForm({
  csrf,
  recordId,
  defaults,
  includeBonus,
  includeOvertime,
}: {
  csrf: string;
  recordId: string;
  defaults: Defaults;
  includeBonus: boolean;
  includeOvertime: boolean;
}) {
  const [state, formAction, pending] = useActionState(savePayrollEntry, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="csrf" value={csrf} />
      <input type="hidden" name="recordId" value={recordId} />
      {state.error ? <Note tone="negative">{state.error}</Note> : null}
      {state.saved ? <Note tone="positive">Draft saved. Totals were recalculated on the server.</Note> : null}
      {state.warnings.map((warning) => (
        <Note key={warning} tone="warn">{warning}</Note>
      ))}
      <fieldset className="rounded-[10px] border border-border-soft p-4">
        <legend className="px-1 text-[14.5px] font-bold text-text">Attendance</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Field label="Total working days" name="totalWorkingDays" defaultValue={defaults.totalWorkingDays} />
          <Field label="Paid days" name="paidDays" defaultValue={defaults.paidDays} />
          <Field label="Absent / LOP days" name="lopDays" defaultValue={defaults.lopDays} />
        </div>
      </fieldset>
      <fieldset className="rounded-[10px] border border-border-soft p-4">
        <legend className="px-1 text-[14.5px] font-bold text-text">Earnings</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Basic salary" name="basicSalary" defaultValue={defaults.basicSalary} />
          <Field label="HRA" name="hra" defaultValue={defaults.hra} />
          <Field label="Special allowance" name="specialAllowance" defaultValue={defaults.specialAllowance} />
          <Field label="Other allowances" name="otherAllowances" defaultValue={defaults.otherAllowances} />
          {includeOvertime ? <Field label="Overtime" name="overtime" defaultValue={defaults.overtime} /> : null}
          {includeBonus ? <Field label="Bonus / incentive" name="bonus" defaultValue={defaults.bonus} /> : null}
        </div>
      </fieldset>
      <fieldset className="rounded-[10px] border border-border-soft p-4">
        <legend className="px-1 text-[14.5px] font-bold text-text">Deductions</legend>
        <p className="mt-2 text-[12.5px] text-muted">Leave a deduction blank when it does not apply. Rates are not calculated automatically.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Employee PF" name="employeePf" defaultValue={defaults.employeePf} />
          <Field label="Employee ESI" name="employeeEsi" defaultValue={defaults.employeeEsi} />
          <Field label="Professional tax" name="professionalTax" defaultValue={defaults.professionalTax} />
          <Field label="TDS" name="tds" defaultValue={defaults.tds} />
          <Field label="Salary advance / loan" name="salaryAdvance" defaultValue={defaults.salaryAdvance} />
          <Field label="Other deductions" name="otherDeductions" defaultValue={defaults.otherDeductions} />
        </div>
      </fieldset>
      {state.preview ? (
        <dl className="grid gap-3 rounded-[10px] border border-border bg-surface-2 p-4 sm:grid-cols-3">
          <Total label="Gross earnings" value={state.preview.gross} />
          <Total label="Total deductions" value={state.preview.deductions} />
          <Total label="Net pay" value={state.preview.net} />
          <p className="sm:col-span-3 text-[13px] text-muted">{state.preview.words}</p>
        </dl>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="intent"
          value="preview"
          disabled={pending}
          className="rounded-[8px] border border-border-accent bg-surface px-4 py-2.5 text-[13.5px] font-medium text-accent hover:bg-accent-soft disabled:opacity-60"
        >
          Preview
        </button>
        <button
          type="submit"
          name="intent"
          value="save"
          disabled={pending}
          className="rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save draft"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
      {label}
      <input
        name={name}
        inputMode="decimal"
        defaultValue={defaultValue}
        className="rounded-[8px] border border-border bg-surface px-3 py-2 font-mono text-[13px] font-normal text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
    </label>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="font-mono text-[18px] font-bold text-text">{value}</dd>
    </div>
  );
}

function Note({ tone, children }: { tone: "negative" | "positive" | "warn"; children: string }) {
  const styles = {
    negative: "bg-negative-soft text-negative",
    positive: "bg-positive-soft text-positive",
    warn: "bg-warn-soft text-warn",
  };
  return <p className={`rounded-[8px] px-3 py-2 text-[13px] ${styles[tone]}`}>{children}</p>;
}
