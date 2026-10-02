"use client";

import { useActionState } from "react";
import { saveCompany, type CompanyFormState } from "@/server/company/actions";

const initialState: CompanyFormState = { error: null, saved: false };

type Defaults = {
  name: string;
  address: string;
  currency: string;
  includeBonus: boolean;
  includeOvertime: boolean;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
};

export function CompanyForm({ csrf, defaults }: { csrf: string; defaults: Defaults }) {
  const [state, formAction, pending] = useActionState(saveCompany, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="csrf" value={csrf} />
      {state.saved ? (
        <p className="rounded-[8px] bg-positive-soft px-3 py-2 text-[13px] text-positive">Company settings saved.</p>
      ) : null}
      {state.error ? (
        <p role="alert" className="rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">
          {state.error}
        </p>
      ) : null}
      <Field label="Employer name" name="name" defaultValue={defaults.name} required />
      <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
        Address
        <textarea
          name="address"
          required
          defaultValue={defaults.address}
          rows={3}
          className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] font-normal text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </label>
      <Field label="Currency" name="currency" defaultValue={defaults.currency} required />
      <label className="flex items-center gap-2 text-[13px] text-text">
        <input name="includeBonus" type="checkbox" defaultChecked={defaults.includeBonus} className="accent-accent" />
        Show bonus or incentive on payslips
      </label>
      <label className="flex items-center gap-2 text-[13px] text-text">
        <input name="includeOvertime" type="checkbox" defaultChecked={defaults.includeOvertime} className="accent-accent" />
        Show overtime on payslips
      </label>
      <Field label="Email subject" name="emailSubjectTemplate" defaultValue={defaults.emailSubjectTemplate} />
      <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
        Email message
        <textarea
          name="emailBodyTemplate"
          defaultValue={defaults.emailBodyTemplate}
          rows={5}
          className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] font-normal text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </label>
      <p className="text-[12.5px] text-muted">
        Placeholders: {"{{employeeName}}"}, {"{{companyName}}"}, {"{{payrollMonth}}"}, {"{{payslipNumber}}"}. Salary amounts are not inserted. The payslip is attached.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save company"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] font-normal text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
    </label>
  );
}
