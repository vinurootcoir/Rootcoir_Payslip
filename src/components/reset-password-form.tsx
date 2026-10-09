"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { resetPassword, type FormState } from "@/server/auth/actions";
import { executeRecaptcha, RecaptchaNotice, RecaptchaScript } from "./recaptcha";

const initialState: FormState = { error: null };

export function ResetPasswordForm({
  csrf,
  token,
  siteKey,
}: {
  csrf: string;
  token: string;
  siteKey: string | null;
}) {
  const [state, formAction, pending] = useActionState(resetPassword, initialState);
  const [clientError, setClientError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setClientError(null);
    try {
      formData.set("recaptchaToken", await executeRecaptcha(siteKey, "reset_password"));
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Security check failed.");
      return;
    }
    formAction(formData);
  }

  return (
    <>
      <RecaptchaScript siteKey={siteKey} />
      <form action={submit} className="flex flex-col gap-4">
        <input type="hidden" name="csrf" value={csrf} />
        <input type="hidden" name="token" value={token} />
        {state.error || clientError ? (
          <p role="alert" className="rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">
            {clientError ?? state.error}
          </p>
        ) : null}
        <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
          New password
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            maxLength={128}
            className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] font-normal text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
          Confirm password
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            maxLength={128}
            className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] font-normal text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="mt-1 rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Updating..." : "Update password"}
        </button>
        <RecaptchaNotice />
        <p className="text-center text-[12.5px] text-muted">
          <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
            Back to sign in
          </Link>
        </p>
      </form>
    </>
  );
}
