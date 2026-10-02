"use client";

import { technicalErrorText } from "@/lib/error-details";
import { StatusScreen } from "@/components/status-screen";

const retryClass =
  "rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover";

export function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const details = technicalErrorText(process.env.NODE_ENV, error);

  return (
    <StatusScreen
      code="Error"
      title="Something went wrong"
      actions={
        <button type="button" onClick={() => reset()} className={retryClass}>
          Try again
        </button>
      }
    >
      {details ? (
        <>
          <p>This detail is shown only in development.</p>
          <pre className="mt-3 max-h-80 overflow-auto rounded-[8px] border border-border bg-surface-2 p-3 text-left font-mono text-[12px] leading-5 whitespace-pre-wrap text-text">
            {details}
          </pre>
        </>
      ) : (
        <p>The page could not be loaded. Try again.</p>
      )}
    </StatusScreen>
  );
}
