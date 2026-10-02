"use client";

import { useActionState } from "react";
import { saveEmployeeSalary, type SalaryFormState } from "@/server/employees/actions";

const initialState: SalaryFormState = { error: null, saved: false, warning: null };

export function SalaryForm({
  csrf,
  defaults,
}: {
  csrf: string;
  defaults: {
    id: string;
    basicSalary: string;
    hra: string;
    specialAllowance: string;
    otherAllowances: string;
    employeePf: string;
    employeeEsi: string;
    professionalTax: string;
    tds: string;
  };
}) {
  const [state, formAction, pending] = useActionState(saveEmployeeSalary, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="csrf" value={csrf} />
      <input type="hidden" name="id" value={defaults.id} />
      {state.error ? (
        <p role="alert" className="rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">
          {state.error}
        </p>
      ) : null}
      {state.saved ? <p className="text-[13px] text-positive">Salary saved. Open draft payslips now use these amounts.</p> : null}
      {state.warning ? <p className="text-[13px] text-negative">{state.warning}</p> : null}
      <fieldset className="rounded-[10px] border border-border-soft p-4">
        <legend className="px-1 text-[13px] font-semibold text-text">Earnings</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField label="Basic salary" name="basicSalary" defaultValue={defaults.basicSalary} />
          <MoneyField label="HRA" name="hra" defaultValue={defaults.hra} />
          <MoneyField label="Special allowance" name="specialAllowance" defaultValue={defaults.specialAllowance} />
          <MoneyField label="Other allowances" name="otherAllowances" defaultValue={defaults.otherAllowances} />
        </div>
      </fieldset>
      <fieldset className="rounded-[10px] border border-border-soft p-4">
        <legend className="px-1 text-[13px] font-semibold text-text">Deductions</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField label="Employee PF" name="employeePf" defaultValue={defaults.employeePf} />
          <MoneyField label="Employee ESI" name="employeeEsi" defaultValue={defaults.employeeEsi} />
          <MoneyField label="Professional tax" name="professionalTax" defaultValue={defaults.professionalTax} />
          <MoneyField label="TDS" name="tds" defaultValue={defaults.tds} />
        </div>
      </fieldset>
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save salary"}
      </button>
    </form>
  );
}

function MoneyField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        inputMode="decimal"
        className="rounded-[8px] border border-border bg-surface px-3 py-2 font-mono text-[13.5px] font-normal text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
    </label>
  );
}
