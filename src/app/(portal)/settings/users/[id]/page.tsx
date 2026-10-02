import Link from "next/link";
import { notFound } from "next/navigation";
import { UserAccessForm } from "@/components/user-access-form";
import { isUuid } from "@/lib/ids";
import { roleLabel } from "@/lib/roles";
import { requireRole } from "@/server/auth/guard";
import { csrfTokenFromRequest } from "@/server/auth/request";
import { getUserAccess } from "@/server/users/queries";

export default async function UserAccessPage({ params }: { params: Promise<{ id: string }> }) {
  const current = await requireRole(["SUPER_ADMIN"]);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { user, activeSuperAdmins } = await getUserAccess(id);
  if (!user) notFound();
  const csrf = await csrfTokenFromRequest();
  const ownAccount = user.id === current.id;
  const lastSuperAdmin = user.role === "SUPER_ADMIN" && user.status === "ACTIVE" && activeSuperAdmins <= 1;

  return (
    <section className="rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <p className="text-[12.5px] text-muted">
        <Link href="/settings/users" className="text-accent">Users</Link>
      </p>
      <h1 className="mt-1 text-[21px] font-bold tracking-[-0.02em]">{user.email}</h1>
      <p className="mt-1 text-[13px] text-muted">
        {roleLabel(user.role)}
        {user.employee ? ` · ${user.employee.fullName} (${user.employee.employeeNumber})` : ""}
      </p>
      {ownAccount ? (
        <p className="mt-4 text-[13.5px] text-muted">Another Super Admin has to change this account.</p>
      ) : (
        <div className="mt-5">
          {lastSuperAdmin ? <p className="mb-3 text-[13px] text-muted">This is the only active Super Admin.</p> : null}
          <UserAccessForm csrf={csrf} userId={user.id} role={user.role} status={user.status} employeeLogin={user.role === "USER"} />
        </div>
      )}
    </section>
  );
}
