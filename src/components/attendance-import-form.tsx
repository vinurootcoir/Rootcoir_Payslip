"use client";

import { useState } from "react";
import { importAttendanceSheet, type AttendanceImportState } from "@/server/payroll/actions";

const empty: AttendanceImportState = { error: null, errors: [], updated: 0 };

export function AttendanceImportForm({ csrf, periodId }: { csrf: string; periodId: string }) {
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<AttendanceImportState>(empty);

  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        data.set("csrf", csrf);
        data.set("periodId", periodId);
        setPending(true);
        try {
          setState(await importAttendanceSheet(data));
        } finally {
          setPending(false);
        }
      }}
    >
      <input
        type="file"
        name="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        aria-label="Attendance Excel file"
        required
        className="block min-w-0 text-[13px] text-text file:mr-3 file:rounded-[8px] file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-[13px] file:font-medium file:text-text"
      />
      {state.error ? <p className="rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">{state.error}</p> : null}
      {state.errors.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">
          {state.errors.slice(0, 20).map((issue) => (
            <li key={`${issue.row}-${issue.message}`}>Row {issue.row}: {issue.message}</li>
          ))}
        </ul>
      ) : null}
      {state.updated > 0 ? (
        <p className="rounded-[8px] bg-positive-soft px-3 py-2 text-[13px] text-positive">
          Updated attendance for {state.updated} {state.updated === 1 ? "payslip" : "payslips"}.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Uploading..." : "Upload attendance"}
      </button>
    </form>
  );
}
