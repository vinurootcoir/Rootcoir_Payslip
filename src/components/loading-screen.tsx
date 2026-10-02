import Image from "next/image";

export function LoadingScreen() {
  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4 py-16">
      <section className="flex w-full max-w-sm flex-col items-center rounded-[10px] border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
        <div className="flex justify-center rounded-[10px] bg-logo-plate px-4 py-3">
          <Image src="/rootcoir.png" alt="Root Coir" width={1600} height={364} className="h-auto w-[180px]" />
        </div>
        <p className="mt-4 text-[13.5px] text-muted">Loading</p>
      </section>
    </main>
  );
}
