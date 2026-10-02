"use client";

import { useActionState, useState } from "react";
import { queuePeriodEmails, type EmailFormState } from "@/server/email/actions";

const initialState: EmailFormState = { error: null, details: [] };

export function EmailSelectedForm({
  csrf,
  periodId,
  rows,
}: {
  csrf: string;
  periodId: string;
  rows: { id: string; fullName: string; email: string; payslipNumber: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(queuePeriodEmails, initialState);
  const [selected, setSelected] = useState<string[]>([]);
  const chosen = new Set(selected);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="csrf" value={csrf} />
      <input type="hidden" name="periodId" value={periodId} />
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-[8px] border border-border-soft px-3 py-2">
            <label className="flex items-start gap-2 text-[13.5px] text-text">
              <input
                type="checkbox"
                name="recordId"
                value={row.id}
                checked={chosen.has(row.id)}
                onChange={(event) => {
                  setSelected((current) =>
                    event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id),
                  );
                }}
                className="mt-0.5 accent-accent"
              />
              <span>
                <span className="font-medium">{row.fullName}</span>
                <span className="mt-0.5 block text-[12.5px] text-muted">{row.email}</span>
                {row.payslipNumber ? <span className="mt-0.5 block font-mono text-[12px] text-faint">{row.payslipNumber}</span> : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-[12.5px] text-muted">{selected.length} selected. Each person receives only their own payslip.</p>
      {state.error ? <p className="rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">{state.error}</p> : null}
      <label className="flex items-start gap-2 text-[13px] text-text">
        <input name="confirm" type="checkbox" required className="mt-0.5 accent-accent" />
        Email the selected payslips.
      </label>
      <button
        type="submit"
        disabled={pending || selected.length === 0}
        className="w-fit rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Queuing..." : "Email selected"}
      </button>
    </form>
  );
}
