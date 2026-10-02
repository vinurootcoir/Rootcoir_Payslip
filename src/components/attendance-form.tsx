"use client";

import { useActionState } from "react";
import { saveAttendance } from "@/server/payroll/actions";

export function AttendanceForm({
  csrf,
  recordId,
  totalWorkingDays,
  paidDays,
  lopDays,
  casualLeaveDays,
  sickLeaveDays,
}: {
  csrf: string;
  recordId: string;
  totalWorkingDays: string;
  paidDays: string;
  lopDays: string;
  casualLeaveDays: string;
  sickLeaveDays: string;
}) {
  const [state, formAction, pending] = useActionState(saveAttendance, { error: null, saved: false });

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="csrf" value={csrf} />
      <input type="hidden" name="recordId" value={recordId} />
      <DayField label="Working days" name="totalWorkingDays" defaultValue={totalWorkingDays} />
      <DayField label="Paid days" name="paidDays" defaultValue={paidDays} />
      <DayField label="Absent / LOP" name="lopDays" defaultValue={lopDays} />
      <DayField label="Casual leave" name="casualLeaveDays" defaultValue={casualLeaveDays} />
      <DayField label="Sick leave" name="sickLeaveDays" defaultValue={sickLeaveDays} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-[8px] bg-accent px-3 py-2 text-[12.5px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save attendance"}
      </button>
      {state.error ? <p className="w-full text-[12.5px] text-negative">{state.error}</p> : null}
      {state.saved ? <p className="w-full text-[12.5px] text-positive">Attendance saved.</p> : null}
    </form>
  );
}

function DayField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        inputMode="decimal"
        className="w-24 rounded-[8px] border border-border bg-surface px-2 py-1.5 font-mono text-[12.5px] font-normal text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
    </label>
  );
}
