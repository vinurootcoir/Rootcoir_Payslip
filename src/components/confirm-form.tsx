"use client";

import { useActionState } from "react";
import type { FinalizeState } from "@/server/payroll/finalize";

const initialState: FinalizeState = { error: null, details: [] };

export function ConfirmForm({
  csrf,
  action,
  hidden,
  confirmLabel,
  buttonLabel,
  reason = false,
}: {
  csrf: string;
  action: (state: FinalizeState, formData: FormData) => Promise<FinalizeState>;
  hidden: Record<string, string>;
  confirmLabel: string;
  buttonLabel: string;
  reason?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="csrf" value={csrf} />
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {reason ? (
        <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
          Reason
          <textarea
            name="reason"
            required
            minLength={5}
            maxLength={500}
            rows={3}
            className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] font-normal text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>
      ) : null}
      <label className="flex items-start gap-2 text-[13px] text-text">
        <input name="confirm" type="checkbox" required className="mt-0.5 accent-accent" />
        {confirmLabel}
      </label>
      {state.error ? <p className="rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">{state.error}</p> : null}
      {state.details.length > 0 ? (
        <ul className="list-disc pl-5 text-[13px] text-negative">
          {state.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Working..." : buttonLabel}
      </button>
    </form>
  );
}
