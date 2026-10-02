"use client";

import { useActionState } from "react";
import { clearPayslipTemplate, savePayslipTemplate, type CompanyFormState } from "@/server/company/actions";

const initial: CompanyFormState = { error: null, saved: false };

export function PayslipTemplateForm({ csrf, hasTemplate }: { csrf: string; hasTemplate: boolean }) {
  const [uploadState, uploadAction, uploading] = useActionState(savePayslipTemplate, initial);
  const [clearState, clearAction, clearing] = useActionState(clearPayslipTemplate, initial);

  return (
    <div className="mt-6 border-t border-border-soft pt-5">
      <h2 className="text-[16px] font-bold tracking-[-0.02em]">Payslip template</h2>
      <p className="mt-1 text-[13px] text-muted">
        Upload a PNG. Payslip figures are placed on top of it. Leave the lower part of the image clear for the amounts.
      </p>
      {hasTemplate ? (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated template preview, not a static asset
        <img src="/settings/company/template" alt="Payslip template" className="mt-3 max-h-48 rounded-[8px] border border-border bg-logo-plate" />
      ) : (
        <p className="mt-3 text-[13px] text-muted">No template yet. Payslips use the standard layout.</p>
      )}
      <form action={uploadAction} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="csrf" value={csrf} />
        <input
          type="file"
          name="template"
          accept="image/png,.png"
          aria-label="Payslip template PNG"
          required
          className="block text-[13px] text-text file:mr-3 file:rounded-[8px] file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-[13px] file:font-medium file:text-text"
        />
        {uploadState.error ? <p className="text-[13px] text-negative">{uploadState.error}</p> : null}
        {uploadState.saved ? <p className="text-[13px] text-positive">Template saved.</p> : null}
        <button
          type="submit"
          disabled={uploading}
          className="w-fit rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
        >
          {uploading ? "Saving..." : "Upload template"}
        </button>
      </form>
      {hasTemplate ? (
        <form action={clearAction} className="mt-3">
          <input type="hidden" name="csrf" value={csrf} />
          {clearState.error ? <p className="mb-2 text-[13px] text-negative">{clearState.error}</p> : null}
          <button type="submit" disabled={clearing} className="text-[13px] font-medium text-negative">
            Remove template
          </button>
        </form>
      ) : null}
    </div>
  );
}
