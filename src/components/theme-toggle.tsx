"use client";

export function ThemeToggle() {
  function toggle() {
    const stored = document.documentElement.dataset.theme;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const current = stored ?? (prefersDark ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle color theme"
      className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[8px] border border-border bg-surface text-muted hover:bg-surface-2"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v1.5M12 19.5V21M4.9 4.9l1.1 1.1M18 18l1.1 1.1M3 12h1.5M19.5 12H21M4.9 19.1 6 18M18 6l1.1-1.1" />
        <circle cx="12" cy="12" r="3.5" />
      </svg>
    </button>
  );
}
