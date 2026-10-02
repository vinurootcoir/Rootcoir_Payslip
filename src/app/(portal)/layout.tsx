import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense } from "react";
import { csrfTokenFromRequest } from "@/server/auth/request";
import { requireUser } from "@/server/auth/guard";
import { roleLabel } from "@/lib/roles";
import { Breadcrumb, EmployeeSearch, MobileMenu, SidebarPanel, type NavItem } from "@/components/portal-nav";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const current = await requireUser();
  const csrf = await csrfTokenFromRequest();
  const isStaff = current.role === "ADMIN" || current.role === "SUPER_ADMIN";
  const groups: { label: string; items: NavItem[] }[] = [
    { label: "Workspace", items: [{ href: "/", label: "Home", icon: "home" }] },
  ];
  if (current.role === "USER") {
    groups[0] = { label: "Workspace", items: [{ href: "/", label: "Payslips", icon: "payroll" }] };
    groups.push({
      label: "Account",
      items: [
        { href: "/me", label: "Profile", icon: "account" },
        { href: "/account", label: "Password", icon: "account" },
      ],
    });
  } else {
    groups.push({ label: "People", items: [{ href: "/employees", label: "Employees", icon: "people" }] });
    groups.push({ label: "Payroll", items: [{ href: "/payroll", label: "Payroll", icon: "payroll" }] });
    const accountItems: NavItem[] = [];
    if (current.role === "SUPER_ADMIN") {
      accountItems.push(
        { href: "/settings/company", label: "Company", icon: "company" },
        { href: "/settings/users", label: "Users", icon: "people" },
        { href: "/settings/audit", label: "Audit log", icon: "audit" },
      );
    }
    accountItems.push({ href: "/account", label: "Password", icon: "account" });
    groups.push({ label: "Account", items: accountItems });
  }

  return (
    <div className="flex min-h-full flex-1 bg-bg">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col bg-nav md:flex">
        <SidebarPanel groups={groups} email={current.email} role={roleLabel(current.role)} csrf={csrf} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border-soft bg-bg px-4 py-3 md:px-7">
          <MobileMenu groups={groups} email={current.email} role={roleLabel(current.role)} csrf={csrf} />
          <Breadcrumb />
          {isStaff ? (
            <Suspense fallback={null}>
              <EmployeeSearch />
            </Suspense>
          ) : (
            <div className="flex-1" />
          )}
          {isStaff ? (
            <Link
              href="/employees/new"
              className="shrink-0 rounded-[8px] bg-accent px-3 py-2 text-[13px] font-medium text-on-accent hover:bg-accent-hover"
            >
              Add employee
            </Link>
          ) : null}
        </header>
        <div className="flex-1 px-4 py-6 md:px-7">{children}</div>
      </div>
    </div>
  );
}
