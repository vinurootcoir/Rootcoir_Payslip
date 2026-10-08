"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { addEmployeesToPeriod } from "@/server/payroll/actions";

type Choice = { id: string; fullName: string; employeeNumber: string; status: "ACTIVE" | "INACTIVE" | "SEPARATED" };

const filters = [
  { id: "ACTIVE", label: "Active" },
  { id: "INACTIVE", label: "Inactive" },
  { id: "SEPARATED", label: "Separated" },
  { id: "ALL", label: "All" },
] as const;

export function AddEmployeeForm({
  csrf,
  periodId,
  employees,
}: {
  csrf: string;
  periodId: string;
  employees: Choice[];
}) {
  const [state, formAction, pending] = useActionState(addEmployeesToPeriod, { error: null, added: 0 });
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("ACTIVE");
  const [selected, setSelected] = useState<string[]>([]);
  const visible = useMemo(
    () => employees.filter((employee) => filter === "ALL" || employee.status === filter),
    [employees, filter],
  );
  const visibleIds = visible.map((employee) => employee.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));

  if (employees.length === 0) {
    return <p className="text-[13px] text-muted">Everyone already has a payslip in this period.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="csrf" value={csrf} />
      <input type="hidden" name="periodId" value={periodId} />
      {state.error ? <p className="rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">{state.error}</p> : null}
      {state.added > 0 ? (
        <p className="rounded-[8px] bg-positive-soft px-3 py-2 text-[13px] text-positive">
          Added {state.added} {state.added === 1 ? "employee" : "employees"}.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1 rounded-[8px] border border-border-soft bg-surface p-1">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-[6px] px-2 py-1 text-[12px] ${
              filter === item.id
                ? "bg-accent-soft font-medium text-accent shadow-[inset_0_-2px_0_0_var(--nav-indicator)]"
                : "text-faint hover:text-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[12.5px] text-text">
        <input
          type="checkbox"
          checked={allVisibleSelected}
          onChange={(event) => {
            setSelected((current) =>
              event.target.checked ? [...new Set([...current, ...visibleIds])] : current.filter((id) => !visibleIds.includes(id)),
            );
          }}
        />
        Select all shown
      </label>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {visible.length === 0 ? <p className="text-[13px] text-muted">No employees in this group.</p> : null}
        {employees.map((employee) => {
          const shown = filter === "ALL" || employee.status === filter;
          return (
            <label key={employee.id} className={shown ? "flex items-center gap-2 text-[13px] text-text" : "hidden"}>
              <input
                type="checkbox"
                name="employeeId"
                value={employee.id}
                checked={selected.includes(employee.id)}
                onChange={(event) => {
                  setSelected((current) =>
                    event.target.checked ? [...current, employee.id] : current.filter((id) => id !== employee.id),
                  );
                }}
              />
              <span>{employee.fullName}</span>
              <span className="font-mono text-[12px] text-muted">{employee.employeeNumber}</span>
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="mode"
          value="selected"
          disabled={pending}
          className="w-fit rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Adding..." : "Add selected"}
        </button>
        <button
          type="submit"
          name="mode"
          value="all-active"
          disabled={pending}
          className="w-fit rounded-[8px] border border-border-accent bg-surface px-4 py-2.5 text-[13.5px] font-medium text-accent hover:bg-accent-soft disabled:opacity-60"
        >
          Add all active
        </button>
      </div>
    </form>
  );
}
