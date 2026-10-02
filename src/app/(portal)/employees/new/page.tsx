import { EmployeeForm } from "@/components/employee-form";
import { EmployeeImportForm } from "@/components/employee-import-form";
import { requireRole } from "@/server/auth/guard";
import { csrfTokenFromRequest } from "@/server/auth/request";

export default async function NewEmployeePage() {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);
  const csrf = await csrfTokenFromRequest();

  return (
    <div className="flex flex-col gap-4">
      <section className="max-w-3xl rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <h1 className="text-[21px] font-bold tracking-[-0.02em]">New employee</h1>
        <p className="mt-1 mb-5 text-[13.5px] text-muted">
          The employee record is separate from a portal login. Access can be added later.
        </p>
        <EmployeeForm csrf={csrf} />
      </section>
      <section className="max-w-3xl rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-[21px] font-bold tracking-[-0.02em]">Bulk upload</h2>
        <p className="mt-1 text-[13.5px] text-muted">
          Add many employee records from an Excel file. Review the rows before they are created. This does not create portal logins.
        </p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page navigation */}
        <a href="/employees/sample" className="mt-3 inline-flex text-[13.5px] font-medium text-accent">
          Download sample Excel
        </a>
        <div className="mt-4">
          <EmployeeImportForm csrf={csrf} />
        </div>
      </section>
    </div>
  );
}
