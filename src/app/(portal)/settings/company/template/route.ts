import { requireRole } from "@/server/auth/guard";
import { loadPayslipTemplate } from "@/server/company/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  await requireRole(["SUPER_ADMIN"]);
  const bytes = await loadPayslipTemplate();
  if (!bytes) return new Response(null, { status: 404 });
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
