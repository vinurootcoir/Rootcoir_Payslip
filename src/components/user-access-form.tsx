"use client";

import { useActionState } from "react";
import type { AccountStatus, UserRole } from "@prisma/client";
import { updateUserAccess, type UserFormState } from "@/server/users/actions";

const initialState: UserFormState = { error: null, saved: false };

export function UserAccessForm({
  csrf,
  userId,
  role,
  status,
  employeeLogin,
}: {
  csrf: string;
  userId: string;
  role: UserRole;
  status: AccountStatus;
  employeeLogin: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateUserAccess, initialState);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="csrf" value={csrf} />
      <input type="hidden" name="userId" value={userId} />
      {state.saved ? (
        <p className="rounded-[8px] bg-positive-soft px-3 py-2 text-[13px] text-positive">
          Access updated.
        </p>
      ) : null}
      {state.error ? <p className="rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">{state.error}</p> : null}
      <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
        Role
        <select
          name="role"
          defaultValue={role}
          className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {employeeLogin ? <option value="USER">Employee</option> : null}
          {employeeLogin ? null : <option value="ADMIN">Admin</option>}
          {employeeLogin ? null : <option value="SUPER_ADMIN">Super Admin</option>}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
        Status
        <select
          name="status"
          defaultValue={status}
          className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save access"}
      </button>
    </form>
  );
}
