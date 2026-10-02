"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  icon: "home" | "people" | "payroll" | "company" | "account" | "audit";
};

export function SidebarNav({ groups }: { groups: { label: string; items: NavItem[] }[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-2 pb-1 text-[11px] font-semibold text-nav-text">{group.label}</p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-[7px] px-2 py-2 text-[13px] text-nav-text hover:text-nav-active ${active ? "bg-nav-hover" : "hover:bg-nav-hover"}`}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function Breadcrumb() {
  const pathname = usePathname();
  const parts = crumbs(pathname);

  return (
    <p className="truncate text-[13px] text-muted">
      {parts.map((part, index) => (
        <span key={part}>
          {index > 0 ? <span className="px-1.5 text-faint">/</span> : null}
          <span className={index === parts.length - 1 ? "text-text" : undefined}>{part}</span>
        </span>
      ))}
    </p>
  );
}

export function EmployeeSearch() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";

  return (
    <form action="/employees" method="get" className="min-w-0 flex-1">
      <input
        name="q"
        defaultValue={q}
        key={q}
        placeholder="Search employees"
        aria-label="Search employees"
        className="w-full max-w-sm rounded-[8px] border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
    </form>
  );
}

function crumbs(pathname: string): string[] {
  if (pathname === "/") return ["Home"];
  if (pathname === "/payroll") return ["Payroll", "Periods"];
  if (/^\/payroll\/[^/]+$/.test(pathname)) return ["Payroll", "Period"];
  if (/^\/payroll\/[^/]+\/email(\/[^/]+)?$/.test(pathname)) return ["Payroll", "Period", "Email"];
  if (pathname.startsWith("/payroll/")) return ["Payroll", "Period", "Entry"];
  if (pathname === "/employees") return ["People", "Employees"];
  if (pathname === "/employees/new") return ["People", "Employees", "New"];
  if (pathname.startsWith("/employees/")) return ["People", "Employees", "Profile"];
  if (pathname === "/me") return ["Account", "Profile"];
  if (pathname === "/settings/company") return ["Settings", "Company"];
  if (pathname === "/settings/users/new") return ["Settings", "Users", "New"];
  if (pathname.startsWith("/settings/users/")) return ["Settings", "Users", "Access"];
  if (pathname === "/settings/users") return ["Settings", "Users"];
  if (pathname === "/settings/audit") return ["Settings", "Audit log"];
  if (pathname === "/account") return ["Account", "Password"];
  if (pathname === "/forbidden") return ["Access denied"];
  return ["Home"];
}

function NavIcon({ name }: { name: NavItem["icon"] }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "home") {
    return (
      <svg {...common}>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
      </svg>
    );
  }
  if (name === "people") {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="9.5" cy="7" r="3" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 4.13a3 3 0 0 1 0 5.75" />
      </svg>
    );
  }
  if (name === "payroll") {
    return (
      <svg {...common}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    );
  }
  if (name === "audit") {
    return (
      <svg {...common}>
        <path d="M8 6h11M8 12h11M8 18h11" />
        <path d="M4 6h.01M4 12h.01M4 18h.01" />
      </svg>
    );
  }
  if (name === "company") {
    return (
      <svg {...common}>
        <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
        <path d="M14 9h5a1 1 0 0 1 1 1v11" />
        <path d="M8 8h2M8 12h2M8 16h2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}
