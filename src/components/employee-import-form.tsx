"use client";

import { useState } from "react";
import {
  importEmployeeSheet,
  reviewEmployeeSheet,
  type EmployeeImportState,
} from "@/server/employees/actions";

const emptyState: EmployeeImportState = { error: null, errors: [], preview: null };

const statusLabel = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SEPARATED: "Separated",
} as const;

export function EmployeeImportForm({ csrf }: { csrf: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState<"review" | "create" | null>(null);
  const [state, setState] = useState<EmployeeImportState>(emptyState);

  async function submit(intent: "review" | "create") {
    if (!file) {
      setState({ ...emptyState, error: "Choose an Excel file." });
      return;
    }
    const formData = new FormData();
    formData.set("csrf", csrf);
    formData.set("file", file);
    setPending(intent);
    try {
      const result = intent === "review" ? await reviewEmployeeSheet(formData) : await importEmployeeSheet(formData);
      setState(result);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="Employee Excel file"
          className="block min-w-0 text-[13px] text-text file:mr-3 file:rounded-[8px] file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-[13px] file:font-medium file:text-text"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setState(emptyState);
          }}
        />
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => submit("review")}
          className="w-fit rounded-[8px] border border-border-accent bg-surface px-4 py-2.5 text-[13.5px] font-medium text-accent hover:bg-accent-soft disabled:opacity-60"
        >
          {pending === "review" ? "Checking..." : "Review file"}
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">
          {state.error}
        </p>
      ) : null}
      {state.errors.length > 0 ? (
        <ul role="alert" className="flex flex-col gap-1 rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">
          {state.errors.slice(0, 20).map((issue) => (
            <li key={`${issue.row}-${issue.message}`}>Row {issue.row}: {issue.message}</li>
          ))}
          {state.errors.length > 20 ? <li>And {state.errors.length - 20} more rows need changes.</li> : null}
        </ul>
      ) : null}
      {state.preview && state.preview.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-muted">
            {state.preview.length} {state.preview.length === 1 ? "employee is" : "employees are"} ready to add. Statutory identifiers stay off this list.
          </p>
          <div className="overflow-x-auto rounded-[8px] border border-border-soft">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="bg-surface-2 text-[12px] text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Number</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Work email</th>
                  <th className="px-3 py-2 font-medium">Department</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {state.preview.map((row) => (
                  <tr key={row.row} className="border-t border-border-soft">
                    <td className="px-3 py-2 font-mono text-[12px]">{row.employeeNumber}</td>
                    <td className="px-3 py-2">{row.fullName}</td>
                    <td className="px-3 py-2">{row.workEmail}</td>
                    <td className="px-3 py-2">{row.department}</td>
                    <td className="px-3 py-2">{statusLabel[row.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => submit("create")}
            className="w-fit rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
          >
            {pending === "create" ? "Adding..." : `Add ${state.preview.length} ${state.preview.length === 1 ? "employee" : "employees"}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
