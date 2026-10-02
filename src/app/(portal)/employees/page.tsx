import Link from "next/link";
import { EmploymentStatus } from "@prisma/client";
import { requireRole } from "@/server/auth/guard";
import { listEmployees, parseEmployeeListQuery } from "@/server/employees/queries";
import { formatDisplayDate } from "@/lib/dates";
import { StatusPill } from "@/components/status-pill";

const filters: { label: string; status: EmploymentStatus | null }[] = [
  { label: "All", status: null },
  { label: "Active", status: "ACTIVE" },
  { label: "Inactive", status: "INACTIVE" },
  { label: "Separated", status: "SEPARATED" },
];

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; imported?: string }>;
}) {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);
  const params = await searchParams;
  const imported = importedCount(params.imported);
  const query = parseEmployeeListQuery(params);
  const result = await listEmployees(query);

  return (
    <section className="rounded-[10px] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[21px] font-bold tracking-[-0.02em]">Employees</h1>
          <p className="text-[12.5px] text-muted">
            {result.total} {result.total === 1 ? "record" : "records"}
          </p>
          {imported ? (
            <p className="mt-1 text-[13px] text-positive">
              {imported} {imported === 1 ? "employee was" : "employees were"} added.
            </p>
          ) : null}
        </div>
        <div className="flex w-fit gap-1 rounded-[8px] bg-surface-2 p-1">
          {filters.map((filter) => {
            const active = query.status === filter.status;
            const href = employeeHref({ q: query.q, status: filter.status, page: 1 });
            return (
              <Link
                key={filter.label}
                href={href}
                className={`rounded-[6px] px-2.5 py-1 text-[12.5px] ${active ? "bg-surface font-medium text-text shadow-[var(--shadow-card)]" : "text-muted"}`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </div>
      {result.employees.length === 0 ? (
        <p className="border-t border-border-soft px-4 py-10 text-[13.5px] text-muted">
          No employees match this view. Add a record when you are ready.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-y border-border-soft bg-surface-2 text-[11.5px] font-semibold text-faint">
                <th className="px-4 py-2 font-semibold">Employee</th>
                <th className="px-4 py-2 font-semibold">Number</th>
                <th className="px-4 py-2 font-semibold">Department</th>
                <th className="px-4 py-2 font-semibold">Joined</th>
                <th className="px-4 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.employees.map((employee) => {
                const href = `/employees/${employee.id}`;
                return (
                  <tr key={employee.id} className="border-b border-border-soft hover:bg-surface-2">
                    <td className="p-0">
                      <Link href={href} className="block px-4 py-3">
                        <span className="text-[13.5px] font-medium text-text">{employee.fullName}</span>
                        <span className="block text-[12.5px] text-muted">{employee.workEmail}</span>
                        <span className="block text-[12.5px] text-faint">{employee.designation}</span>
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link href={href} className="block px-4 py-3 font-mono text-[12.5px] text-text">
                        {employee.employeeNumber}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link href={href} className="block px-4 py-3 text-[13px] text-text">
                        {employee.department}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link href={href} className="block px-4 py-3 font-mono text-[12.5px] text-muted">
                        {formatDisplayDate(employee.dateOfJoining)}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link href={href} className="block px-4 py-3">
                        <StatusPill status={employee.status} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {result.pageCount > 1 ? (
        <div className="flex items-center justify-between px-4 py-3 text-[12.5px] text-muted">
          <span>
            Page {result.page} of {result.pageCount}
          </span>
          <div className="flex gap-2">
            {result.page > 1 ? (
              <Link href={employeeHref({ ...query, page: result.page - 1 })} className="rounded-[8px] border border-border px-2 py-1">
                Previous
              </Link>
            ) : null}
            {result.page < result.pageCount ? (
              <Link href={employeeHref({ ...query, page: result.page + 1 })} className="rounded-[8px] border border-border px-2 py-1">
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function importedCount(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const count = Number(value);
  if (count < 1 || count > 300) return null;
  return count;
}

function employeeHref(input: { q: string; status: EmploymentStatus | null; page: number }) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.status) params.set("status", input.status);
  if (input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/employees?${query}` : "/employees";
}
