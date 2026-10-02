"use client";

import { useActionState } from "react";
import { createPortalUser, type UserFormState } from "@/server/users/actions";

const initialState: UserFormState = { error: null, saved: false };

export function UserCreateForm({
  csrf,
  employees,
}: {
  csrf: string;
  employees: { id: string; fullName: string; employeeNumber: string; workEmail: string }[];
}) {
  const [state, formAction, pending] = useActionState(createPortalUser, initialState);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="csrf" value={csrf} />
      {state.error ? <p className="rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">{state.error}</p> : null}
      <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
        Role
        <select
          name="role"
          defaultValue="USER"
          className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <option value="USER">Employee</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
        Employee
        <select
          name="employeeId"
          defaultValue=""
          className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <option value="">Not an employee login</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName} ({employee.employeeNumber})
            </option>
          ))}
        </select>
      </label>
      <p className="text-[12.5px] text-muted">An employee login uses the work email on the employee record. Admin logins use the email below.</p>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
        Admin email
        <input
          name="email"
          type="email"
          autoComplete="off"
          className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
        Temporary password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          maxLength={128}
          className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
          className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Creating..." : "Create login"}
      </button>
    </form>
  );
}
