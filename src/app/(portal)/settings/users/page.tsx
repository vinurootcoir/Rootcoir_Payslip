import Link from "next/link";
import { requireRole } from "@/server/auth/guard";
import { listUsers } from "@/server/users/queries";
import { roleLabel } from "@/lib/roles";

export default async function UsersPage() {
  await requireRole(["SUPER_ADMIN"]);
  const users = await listUsers();

  return (
    <section className="rounded-[10px] border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <div>
          <h1 className="text-[21px] font-bold tracking-[-0.02em]">Users</h1>
          <p className="text-[12.5px] text-muted">Portal logins. Employee accounts use the work email on the employee record.</p>
        </div>
        <Link href="/settings/users/new" className="rounded-[8px] bg-accent px-3 py-2 text-[13px] font-medium text-on-accent hover:bg-accent-hover">
          Add login
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-y border-border-soft bg-surface-2 text-[11.5px] font-semibold text-faint">
              <th className="px-4 py-2 font-semibold">Email</th>
              <th className="px-4 py-2 font-semibold">Role</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2 font-semibold">Employee</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border-soft hover:bg-surface-2">
                <td className="px-4 py-3">
                  <Link href={`/settings/users/${user.id}`} className="text-[13.5px] font-medium text-text">{user.email}</Link>
                </td>
                <td className="px-4 py-3 text-[13px] text-muted">{roleLabel(user.role)}</td>
                <td className="px-4 py-3 text-[13px] text-muted">{user.status === "ACTIVE" ? "Active" : "Inactive"}</td>
                <td className="px-4 py-3 text-[13px] text-muted">
                  {user.employee ? `${user.employee.fullName} (${user.employee.employeeNumber})` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
