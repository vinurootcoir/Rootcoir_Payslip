"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4">
      <section className="max-w-md rounded-[10px] border border-border bg-surface p-6 text-center shadow-[var(--shadow-card)]">
        <h1 className="text-[21px] font-bold tracking-[-0.02em]">Something went wrong</h1>
        <p className="mt-2 text-[13.5px] text-muted">The page could not be loaded. Try again.</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-5 rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
