import "server-only";
import { getDb } from "@/server/db";

const visible = ["FINALIZED", "VOID"] as const;

export async function getOwnProfile(employeeId: string | null) {
  if (!employeeId) return null;
  return getDb().employee.findUnique({
    where: { id: employeeId },
    select: {
      fullName: true,
      employeeNumber: true,
      designation: true,
      department: true,
      dateOfJoining: true,
      workEmail: true,
      status: true,
    },
  });
}

export async function listOwnPayslips(employeeId: string, year: number | null) {
  const db = getDb();
  const where = { employeeId, status: { in: [...visible] } };
  const [records, years] = await Promise.all([
    db.payrollRecord.findMany({
      where: year ? { ...where, payrollPeriod: { year } } : where,
      orderBy: [{ payrollPeriod: { year: "desc" } }, { payrollPeriod: { month: "desc" } }, { revision: "desc" }],
      select: {
        id: true,
        status: true,
        revision: true,
        payslipNumber: true,
        snapshot: true,
        payrollPeriod: { select: { id: true, year: true, month: true } },
      },
    }),
    db.payrollPeriod.findMany({
      where: { records: { some: where } },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    }),
  ]);
  return { records, years: years.map((period) => period.year) };
}
