import Link from "next/link";
import { UserCreateForm } from "@/components/user-create-form";
import { requireRole } from "@/server/auth/guard";
import { csrfTokenFromRequest } from "@/server/auth/request";
import { listEmployeesWithoutLogin } from "@/server/users/queries";

export default async function NewUserPage() {
  await requireRole(["SUPER_ADMIN"]);
  const [csrf, employees] = await Promise.all([csrfTokenFromRequest(), listEmployeesWithoutLogin()]);

  return (
    <section className="rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <p className="text-[12.5px] text-muted">
        <Link href="/settings/users" className="text-accent">Users</Link>
      </p>
      <h1 className="mt-1 text-[21px] font-bold tracking-[-0.02em]">Add login</h1>
      <p className="mt-2 mb-5 text-[13.5px] text-muted">The password is not stored in the audit log. Ask the person to change it after signing in.</p>
      {employees.length === 0 ? <p className="mb-4 text-[13px] text-muted">Every employee already has a portal login. You can still add an admin.</p> : null}
      <UserCreateForm csrf={csrf} employees={employees} />
    </section>
  );
}
