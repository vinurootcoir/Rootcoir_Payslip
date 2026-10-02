"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { logout } from "@/server/auth/actions";

export type NavItem = {
  href: string;
  label: string;
  icon: "home" | "people" | "payroll" | "company" | "account" | "audit";
};

export function SidebarNav({
  groups,
  onNavigate,
}: {
  groups: { label: string; items: NavItem[] }[];
  onNavigate?: () => void;
}) {
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
                  onClick={onNavigate}
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

export function SidebarPanel({
  groups,
  email,
  role,
  csrf,
  onNavigate,
  headerAction,
}: {
  groups: { label: string; items: NavItem[] }[];
  email: string;
  role: string;
  csrf: string;
  onNavigate?: () => void;
  headerAction?: ReactNode;
}) {
  return (
    <>
      <div className="flex items-start">
        <Link href="/" onClick={onNavigate} className="mx-3 mt-4 min-w-0 flex-1 rounded-[8px] bg-logo-plate px-2 py-2">
          <Image src="/rootcoir.png" alt="Root Coir" width={1600} height={364} className="h-auto w-full" />
        </Link>
        {headerAction}
      </div>
      <SidebarNav groups={groups} onNavigate={onNavigate} />
      <div className="border-t border-nav-hover px-4 py-3">
        <p className="truncate text-[13px] font-medium text-nav-text">{email}</p>
        <p className="text-[12px] text-nav-text">{role}</p>
        <form action={logout} className="mt-2">
          <input type="hidden" name="csrf" value={csrf} />
          <button type="submit" className="text-[12.5px] text-nav-text hover:text-nav-active">
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}

export function MobileMenu({
  groups,
  email,
  role,
  csrf,
}: {
  groups: { label: string; items: NavItem[] }[];
  email: string;
  role: string;
  csrf: string;
}) {
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenPath(null);
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const drawer = open
    ? createPortal(
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-nav/50" onClick={() => setOpenPath(null)} />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 flex w-[min(280px,88vw)] animate-[drawer-in_180ms_ease-out] flex-col bg-nav shadow-[var(--shadow-card)]"
          >
            <SidebarPanel
              groups={groups}
              email={email}
              role={role}
              csrf={csrf}
              onNavigate={() => setOpenPath(null)}
              headerAction={
                <button
                  ref={closeRef}
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpenPath(null)}
                  className="mr-3 mt-4 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-nav-text hover:bg-nav-hover hover:text-nav-active"
                >
                  <CloseIcon />
                </button>
              }
            />
          </aside>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpenPath(pathname)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-border bg-surface text-text md:hidden"
      >
        <MenuIcon />
      </button>
      {drawer}
    </>
  );
}

type Crumb = { label: string; href?: string };

type EmployeeSuggestion = {
  id: string;
  fullName: string;
  employeeNumber: string;
  workEmail: string;
  department: string;
};

export function Breadcrumb() {
  const pathname = usePathname();
  const parts = crumbs(pathname);

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 truncate text-[13px] text-muted">
      {parts.map((part, index) => (
        <span key={`${part.label}-${index}`}>
          {index > 0 ? <span className="px-1.5 text-faint">/</span> : null}
          {part.href ? (
            <Link href={part.href} className="hover:text-text">
              {part.label}
            </Link>
          ) : (
            <span className="text-text">{part.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function EmployeeSearch() {
  const q = useSearchParams().get("q") ?? "";
  return <EmployeeSearchField key={q} initialQuery={q} />;
}

function EmployeeSearchField({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const edited = useRef(false);
  const [value, setValue] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [matches, setMatches] = useState<EmployeeSuggestion[]>([]);

  useEffect(() => {
    const term = value.trim();
    if (!edited.current || term.length === 0) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/employees/suggest?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })
        .then(async (response) => {
          if (!response.ok) return { employees: [] as EmployeeSuggestion[] };
          return (await response.json()) as { employees?: EmployeeSuggestion[] };
        })
        .then((body) => {
          setMatches(Array.isArray(body.employees) ? body.employees : []);
          setActive(0);
          setOpen(true);
        })
        .catch(() => undefined);
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    function close(event: PointerEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  function choose(employee: EmployeeSuggestion) {
    edited.current = false;
    setOpen(false);
    setValue(employee.fullName);
    router.push(`/employees/${employee.id}`);
  }

  return (
    <div ref={box} className="relative min-w-0 flex-1">
      <form
        action="/employees"
        method="get"
        className="min-w-0"
        onSubmit={() => setOpen(false)}
      >
        <input
          name="q"
          value={value}
          role="combobox"
          aria-label="Search employees"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="Search employees"
          autoComplete="off"
          onChange={(event) => {
            edited.current = true;
            setValue(event.target.value);
          }}
          onFocus={() => {
            if (matches.length > 0 && value.trim().length > 0) setOpen(true);
          }}
          onKeyDown={(event) => {
            if (!open || matches.length === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => (index + 1) % matches.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => (index - 1 + matches.length) % matches.length);
            } else if (event.key === "Enter" && matches[active]) {
              event.preventDefault();
              choose(matches[active]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className="w-full max-w-sm rounded-[8px] border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </form>
      {open && value.trim().length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-20 mt-1 w-full max-w-sm overflow-hidden rounded-[8px] border border-border bg-surface shadow-[var(--shadow-card)]"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-muted">No matching employees.</li>
          ) : (
            matches.map((employee, index) => (
              <li key={employee.id} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(employee)}
                  className={`block w-full px-3 py-2 text-left ${index === active ? "bg-surface-2" : ""}`}
                >
                  <span className="block text-[13px] font-medium text-text">{employee.fullName}</span>
                  <span className="block font-mono text-[12px] text-muted">
                    {employee.employeeNumber} · {employee.department}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

function crumbs(pathname: string): Crumb[] {
  const home: Crumb = { label: "Home", href: "/" };
  if (pathname === "/") return [{ label: "Home" }];
  if (pathname === "/payroll") return [home, { label: "Payroll" }];
  const period = pathname.match(/^\/payroll\/([^/]+)$/);
  if (period) return [home, { label: "Payroll", href: "/payroll" }, { label: "Period" }];
  const email = pathname.match(/^\/payroll\/([^/]+)\/email(?:\/[^/]+)?$/);
  if (email) {
    return [home, { label: "Payroll", href: "/payroll" }, { label: "Period", href: `/payroll/${email[1]}` }, { label: "Email" }];
  }
  const entry = pathname.match(/^\/payroll\/([^/]+)\/([^/]+)$/);
  if (entry) {
    return [home, { label: "Payroll", href: "/payroll" }, { label: "Period", href: `/payroll/${entry[1]}` }, { label: "Entry" }];
  }
  if (pathname === "/employees") return [home, { label: "Employees" }];
  if (pathname === "/employees/new") return [home, { label: "Employees", href: "/employees" }, { label: "New" }];
  if (pathname.startsWith("/employees/")) return [home, { label: "Employees", href: "/employees" }, { label: "Profile" }];
  if (pathname === "/me") return [home, { label: "Profile" }];
  if (pathname === "/settings/company") return [home, { label: "Company" }];
  if (pathname === "/settings/users/new") return [home, { label: "Users", href: "/settings/users" }, { label: "New" }];
  if (pathname.startsWith("/settings/users/")) return [home, { label: "Users", href: "/settings/users" }, { label: "Access" }];
  if (pathname === "/settings/users") return [home, { label: "Users" }];
  if (pathname === "/settings/audit") return [home, { label: "Audit log" }];
  if (pathname === "/account") return [home, { label: "Password" }];
  if (pathname === "/forbidden") return [{ label: "Access denied" }];
  return [{ label: "Home" }];
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
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
