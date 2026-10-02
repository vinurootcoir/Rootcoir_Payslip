"use client";

import { EmploymentStatus } from "@prisma/client";
import { useActionState } from "react";
import { saveEmployee, type EmployeeFormState } from "@/server/employees/actions";

const initialState: EmployeeFormState = { error: null };

type Defaults = {
  id?: string;
  employeeNumber: string;
  fullName: string;
  workEmail: string;
  phone: string;
  designation: string;
  department: string;
  dateOfJoining: string;
  status: EmploymentStatus;
  pan: string;
  uan: string;
  esiNumber: string;
};

const emptyDefaults: Defaults = {
  employeeNumber: "",
  fullName: "",
  workEmail: "",
  phone: "",
  designation: "",
  department: "",
  dateOfJoining: "",
  status: "ACTIVE",
  pan: "",
  uan: "",
  esiNumber: "",
};

export function EmployeeForm({
  csrf,
  defaults = emptyDefaults,
}: {
  csrf: string;
  defaults?: Defaults;
}) {
  const [state, formAction, pending] = useActionState(saveEmployee, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="csrf" value={csrf} />
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {state.error ? (
        <p role="alert" className="rounded-[8px] bg-negative-soft px-3 py-2 text-[13px] text-negative">
          {state.error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Employee number" name="employeeNumber" defaultValue={defaults.employeeNumber} required />
        <Field label="Full name" name="fullName" defaultValue={defaults.fullName} required />
        <Field label="Work email" name="workEmail" type="email" defaultValue={defaults.workEmail} required />
        <Field label="Phone" name="phone" defaultValue={defaults.phone} />
        <Field label="Designation" name="designation" defaultValue={defaults.designation} required />
        <Field label="Department" name="department" defaultValue={defaults.department} required />
        <Field label="Date of joining" name="dateOfJoining" type="date" defaultValue={defaults.dateOfJoining} required />
        <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
          Employment status
          <select
            name="status"
            defaultValue={defaults.status}
            className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] font-normal text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SEPARATED">Separated</option>
          </select>
        </label>
      </div>
      <fieldset className="rounded-[10px] border border-border-soft p-4">
        <legend className="px-1 text-[13px] font-semibold text-text">Statutory identifiers</legend>
        <p className="mb-3 text-[12.5px] text-muted">Optional. These stay off the employee list.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="PAN" name="pan" defaultValue={defaults.pan} />
          <Field label="UAN" name="uan" defaultValue={defaults.uan} />
          <Field label="ESI number" name="esiNumber" defaultValue={defaults.esiNumber} />
        </div>
      </fieldset>
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save employee"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13.5px] font-normal text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
    </label>
  );
}
