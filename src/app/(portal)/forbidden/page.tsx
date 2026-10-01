import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <section className="max-w-xl rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <h1 className="text-[21px] font-bold tracking-[-0.02em]">Access denied</h1>
      <p className="mt-2 text-[13.5px] text-muted">Your role does not include this page.</p>
      <Link href="/" className="mt-4 inline-flex text-[13.5px] font-medium text-accent">
        Back to home
      </Link>
    </section>
  );
}
