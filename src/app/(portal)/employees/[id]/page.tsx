import { notFound } from "next/navigation";
import { EmployeeForm } from "@/components/employee-form";
import { requireRole } from "@/server/auth/guard";
import { csrfTokenFromRequest } from "@/server/auth/request";
import { employeeDefaults } from "@/server/employees/schema";
import { getEmployee } from "@/server/employees/queries";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  const employee = await getEmployee(id);
  if (!employee) notFound();
  const csrf = await csrfTokenFromRequest();

  return (
    <section className="max-w-3xl rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <h1 className="text-[21px] font-bold tracking-[-0.02em]">{employee.fullName}</h1>
      <p className="mt-1 mb-5 text-[13.5px] text-muted">
        {employee.user ? "A portal login is linked to this employee." : "No portal login is linked yet."}
      </p>
      <EmployeeForm csrf={csrf} defaults={employeeDefaults(employee)} />
    </section>
  );
}
