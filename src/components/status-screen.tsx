import type { ReactNode } from "react";
import Image from "next/image";

export function StatusScreen({
  code,
  title,
  children,
  actions,
}: {
  code: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4 py-10">
      <section className="w-full max-w-lg rounded-[10px] border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
        <div className="mb-5 flex justify-center rounded-[10px] bg-logo-plate px-4 py-3">
          <Image src="/rootcoir.png" alt="Root Coir" width={1600} height={364} className="h-auto w-[220px]" />
        </div>
        <p className="font-mono text-[12px] font-medium tracking-[0.08em] text-faint">{code}</p>
        <h1 className="mt-1 text-[21px] font-bold tracking-[-0.02em] text-heading">{title}</h1>
        <div className="mt-2 text-[13.5px] leading-5 text-muted">{children}</div>
        <div className="mt-5 flex flex-wrap gap-3">{actions}</div>
      </section>
    </main>
  );
}
