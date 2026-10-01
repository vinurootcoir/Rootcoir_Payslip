import Link from "next/link";
import { requireUser } from "@/server/auth/guard";
import { roleLabel } from "@/lib/roles";

export default async function HomePage() {
  const current = await requireUser();

  return (
    <section className="max-w-3xl rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <h1 className="text-[21px] font-bold tracking-[-0.02em]">Welcome</h1>
      <p className="mt-2 text-[13.5px] text-muted">
        Signed in as {current.email}. Your role is {roleLabel(current.role)}.
      </p>
      <p className="mt-3 text-[13.5px] text-text">
        Employee records, payroll, and payslips will appear here once those steps are in place.
      </p>
      <Link
        href="/account"
        className="mt-5 inline-flex rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover"
      >
        Account password
      </Link>
    </section>
  );
}
