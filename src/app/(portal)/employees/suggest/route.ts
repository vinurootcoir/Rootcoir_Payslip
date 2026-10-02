import { requireRole } from "@/server/auth/guard";
import { suggestEmployees } from "@/server/employees/queries";
import { logFailure } from "@/lib/log";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  await requireRole(["SUPER_ADMIN", "ADMIN"]);
  const query = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const employees = await suggestEmployees(query);
    return Response.json(
      { employees },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    logFailure("employee.suggest", error);
    return Response.json({ employees: [] }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
