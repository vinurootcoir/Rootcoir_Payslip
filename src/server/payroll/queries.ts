import "server-only";
import { getDb } from "@/server/db";

export async function listPayrollPeriods() {
  return getDb().payrollPeriod.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: {
      id: true,
      year: true,
      month: true,
      status: true,
      _count: { select: { records: true } },
    },
  });
}

export async function getPayrollPeriod(id: string) {
  return getDb().payrollPeriod.findUnique({
    where: { id },
    select: {
      id: true,
      year: true,
      month: true,
      status: true,
      records: {
        orderBy: [{ employee: { fullName: "asc" } }, { revision: "desc" }],
        select: {
          id: true,
          revision: true,
          status: true,
          payslipNumber: true,
          netPay: true,
          currency: true,
          snapshot: true,
          employee: { select: { fullName: true, employeeNumber: true } },
        },
      },
    },
  });
}

export async function employeesAvailableForPeriod(periodId: string) {
  const existing = await getDb().payrollRecord.findMany({
    where: { payrollPeriodId: periodId, status: { not: "VOID" } },
    select: { employeeId: true },
  });
  const taken = existing.map((row) => row.employeeId);
  return getDb().employee.findMany({
    where: { status: "ACTIVE", id: { notIn: taken } },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, employeeNumber: true },
  });
}

export async function getPayrollRecord(id: string) {
  return getDb().payrollRecord.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      revision: true,
      payslipNumber: true,
      currency: true,
      totalWorkingDays: true,
      paidDays: true,
      lopDays: true,
      basicSalary: true,
      hra: true,
      specialAllowance: true,
      otherAllowances: true,
      overtime: true,
      bonus: true,
      grossEarnings: true,
      employeePf: true,
      employeeEsi: true,
      professionalTax: true,
      tds: true,
      salaryAdvance: true,
      otherDeductions: true,
      totalDeductions: true,
      netPay: true,
      amountInWords: true,
      snapshot: true,
      voidReason: true,
      supersedes: { select: { id: true, revision: true, payslipNumber: true } },
      supersededBy: {
        orderBy: { revision: "desc" },
        take: 1,
        select: { id: true, revision: true, status: true },
      },
      employee: {
        select: {
          fullName: true,
          employeeNumber: true,
          designation: true,
          department: true,
          pan: true,
          uan: true,
          esiNumber: true,
        },
      },
      payrollPeriod: { select: { id: true, year: true, month: true, status: true } },
    },
  });
}
