"use client";

import { useActionState } from "react";
import { createPayrollPeriod } from "@/server/payroll/actions";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function PeriodCreateForm({ csrf, year, month }: { csrf: string; year: number; month: number }) {
  const [state, formAction, pending] = useActionState(createPayrollPeriod, { error: null });

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="csrf" value={csrf} />
      {state.error ? <p className="rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">{state.error}</p> : null}
      <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
        Month
        <select
          name="month"
          defaultValue={String(month)}
          className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {months.map((label, index) => (
            <option key={label} value={index + 1}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
        Year
        <input
          name="year"
          defaultValue={year}
          inputMode="numeric"
          className="rounded-[8px] border border-border bg-surface px-3 py-2 font-mono text-[13px] text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Creating..." : "Create period"}
      </button>
    </form>
  );
}
