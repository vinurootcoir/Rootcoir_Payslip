import { redirect, unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { loadPayslipPdf } from "@/server/payroll/download";
import { logFailure } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ periodId: string; recordId: string }> },
): Promise<Response> {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  const { periodId, recordId } = await context.params;

  try {
    const pdf = await loadPayslipPdf(periodId, recordId);
    if (!pdf) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(pdf.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdf.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    logFailure("payroll.pdf", error);
    return new Response(null, { status: 500 });
  }
}
