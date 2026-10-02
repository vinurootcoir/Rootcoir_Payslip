import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/server/auth/actions";
import { csrfTokenFromRequest } from "@/server/auth/request";
import { requireUser } from "@/server/auth/guard";
import { roleLabel } from "@/lib/roles";
import { Breadcrumb, EmployeeSearch, SidebarNav, type NavItem } from "@/components/portal-nav";

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
        <Link href="/" className="mx-3 mt-4 rounded-[8px] bg-logo-plate px-2 py-2">
          <Image src="/rootcoir.png" alt="Root Coir" width={1600} height={364} className="h-auto w-full" />
        </Link>
        <SidebarNav groups={groups} />
        <div className="border-t border-nav-hover px-4 py-3">
          <p className="truncate text-[13px] font-medium text-nav-text">{current.email}</p>
          <p className="text-[12px] text-nav-text">{roleLabel(current.role)}</p>
          <form action={logout} className="mt-2">
            <input type="hidden" name="csrf" value={csrf} />
            <button type="submit" className="text-[12.5px] text-nav-text hover:text-nav-active">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border-soft bg-bg px-4 py-3 md:px-7">
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
        <div className="border-b border-border-soft px-4 py-2 md:hidden">
          <div className="flex flex-wrap items-center gap-2">
            {groups.flatMap((group) => group.items).map((item) => (
              <Link key={item.href} href={item.href} className="rounded-[7px] bg-surface px-2 py-1 text-[12.5px] text-text">
                {item.label}
              </Link>
            ))}
            <form action={logout}>
              <input type="hidden" name="csrf" value={csrf} />
              <button type="submit" className="rounded-[7px] px-2 py-1 text-[12.5px] text-muted">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="flex-1 px-4 py-6 md:px-7">{children}</div>
      </div>
    </div>
  );
}
