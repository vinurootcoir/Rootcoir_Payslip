import "server-only";
import { getDb } from "@/server/db";

export async function getStaffDashboard() {
  const db = getDb();
  const [draftPeriods, finalizedPeriods, activeEmployees, periods, batches] = await Promise.all([
    db.payrollPeriod.count({ where: { status: "DRAFT" } }),
    db.payrollPeriod.count({ where: { status: "FINALIZED" } }),
    db.employee.count({ where: { status: "ACTIVE" } }),
    db.payrollPeriod.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 6,
      select: { id: true, year: true, month: true, status: true, _count: { select: { records: true } } },
    }),
    db.emailBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        status: true,
        totalCount: true,
        sentCount: true,
        failedCount: true,
        createdAt: true,
        payrollPeriod: { select: { id: true, year: true, month: true } },
      },
    }),
  ]);

  return { draftPeriods, finalizedPeriods, activeEmployees, periods, batches };
}
