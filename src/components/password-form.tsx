"use client";

import { useActionState } from "react";
import { changePassword, type FormState } from "@/server/auth/actions";

const initialState: FormState = { error: null };

export function PasswordForm({ csrf }: { csrf: string }) {
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="csrf" value={csrf} />
      {state.error ? (
        <p role="alert" className="rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">
          {state.error}
        </p>
      ) : null}
      <Field label="Current password" name="currentPassword" autoComplete="current-password" />
      <Field label="New password" name="newPassword" autoComplete="new-password" />
      <Field label="Confirm new password" name="confirmPassword" autoComplete="new-password" />
      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-fit rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  autoComplete,
}: {
  label: string;
  name: string;
  autoComplete: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
      {label}
      <input
        name={name}
        type="password"
        autoComplete={autoComplete}
        required
        minLength={name === "currentPassword" ? 1 : 12}
        className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] font-normal text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
    </label>
  );
}
