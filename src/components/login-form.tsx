"use client";

import { useActionState } from "react";
import { login, type FormState } from "@/server/auth/actions";

const initialState: FormState = { error: null };

export function LoginForm({
  csrf,
  passwordChanged,
}: {
  csrf: string;
  passwordChanged: boolean;
}) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="csrf" value={csrf} />
      {passwordChanged ? (
        <p className="rounded-[8px] bg-positive-soft px-3 py-2 text-[13px] text-positive">
          Password updated. Sign in with the new password.
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">
          {state.error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] font-normal text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] font-normal text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
