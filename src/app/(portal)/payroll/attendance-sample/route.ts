import { requireRole } from "@/server/auth/guard";
import { buildAttendanceSampleWorkbook } from "@/server/payroll/attendance-sheet";
import { logFailure } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);
  try {
    const bytes = await buildAttendanceSampleWorkbook();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="attendance-upload-sample.xlsx"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logFailure("payroll.attendance", error);
    return new Response(null, { status: 500 });
  }
}
