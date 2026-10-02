"use client";

import { useActionState } from "react";
import { addEmployeeToPeriod } from "@/server/payroll/actions";

export function AddEmployeeForm({
  csrf,
  periodId,
  employees,
}: {
  csrf: string;
  periodId: string;
  employees: { id: string; fullName: string; employeeNumber: string }[];
}) {
  const [state, formAction, pending] = useActionState(addEmployeeToPeriod, { error: null });
  if (employees.length === 0) {
    return <p className="text-[13px] text-muted">Every active employee already has a payslip in this period.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="csrf" value={csrf} />
      <input type="hidden" name="periodId" value={periodId} />
      {state.error ? <p className="rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">{state.error}</p> : null}
      <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
        Active employee
        <select
          name="employeeId"
          required
          defaultValue=""
          className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <option value="" disabled>
            Choose
          </option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName} ({employee.employeeNumber})
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add to period"}
      </button>
    </form>
  );
}
