import { EmployeeForm } from "@/components/employee-form";
import { requireRole } from "@/server/auth/guard";
import { csrfTokenFromRequest } from "@/server/auth/request";

export default async function NewEmployeePage() {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);
  const csrf = await csrfTokenFromRequest();

  return (
    <section className="max-w-3xl rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <h1 className="text-[21px] font-bold tracking-[-0.02em]">New employee</h1>
      <p className="mt-1 mb-5 text-[13.5px] text-muted">
        The employee record is separate from a portal login. Access can be added later.
      </p>
      <EmployeeForm csrf={csrf} />
    </section>
  );
}
