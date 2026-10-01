import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { logout } from "@/server/auth/actions";
import { csrfTokenFromRequest } from "@/server/auth/request";
import { requireUser } from "@/server/auth/guard";
import { roleLabel } from "@/lib/roles";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const current = await requireUser();
  const csrf = await csrfTokenFromRequest();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-bg">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border-soft bg-bg px-7 py-3">
        <Link href="/" className="rounded-[8px] bg-logo-plate px-2 py-1">
          <Image src="/rootcoir.png" alt="Root Coir" width={1600} height={364} className="h-8 w-auto" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-[13px] font-medium text-text">{current.email}</p>
            <p className="text-[12px] text-muted">{roleLabel(current.role)}</p>
          </div>
          <ThemeToggle />
          <form action={logout}>
            <input type="hidden" name="csrf" value={csrf} />
            <button
              type="submit"
              className="rounded-[8px] border border-border bg-surface px-3 py-2 text-[13px] text-text hover:bg-surface-2"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="flex-1 px-7 py-6">{children}</div>
    </div>
  );
}
