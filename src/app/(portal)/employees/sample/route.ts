import { requireRole } from "@/server/auth/guard";
import { buildEmployeeSampleWorkbook } from "@/server/employees/sheet";
import { logFailure } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);
  try {
    const bytes = await buildEmployeeSampleWorkbook();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="employee-upload-sample.xlsx"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logFailure("employee.sample", error);
    return new Response(null, { status: 500 });
  }
}
