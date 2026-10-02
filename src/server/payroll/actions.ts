"use server";

import { logFailure } from "@/lib/log";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireRole } from "@/server/auth/guard";
import { mutationGuard } from "@/server/auth/request";
import { getDb } from "@/server/db";
import { formatMoney } from "@/lib/money";
import { calculatePayroll } from "./calculate";
import { payrollEntryFormData, payrollEntrySchema } from "./schema";

const staff = ["SUPER_ADMIN", "ADMIN"] as const;

export type PayrollFormState = {
  error: string | null;
  saved: boolean;
  warnings: string[];
  preview: null | {
    gross: string;
    deductions: string;
    net: string;
    words: string;
  };
};

const emptyState: PayrollFormState = { error: null, saved: false, warnings: [], preview: null };

function issue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

export async function createPayrollPeriod(
  _state: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { error: blocked };
  const actor = await requireRole(staff);
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    return { error: "Choose a valid month and year." };
  }

  try {
    const period = await getDb().payrollPeriod.create({
      data: { year, month, createdById: actor.id },
      select: { id: true },
    });
    revalidatePath("/payroll");
    redirect(`/payroll/${period.id}`);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "That month already has a payroll period." };
    }
    logFailure("payroll.period", error);
    return { error: "Something went wrong. Try again." };
  }
}

export async function addEmployeeToPeriod(
  _state: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { error: blocked };
  const actor = await requireRole(staff);
  const periodId = String(formData.get("periodId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  if (!periodId || !employeeId) return { error: "Choose an employee." };

  try {
    const db = getDb();
    const period = await db.payrollPeriod.findUnique({ where: { id: periodId }, select: { status: true } });
    if (!period) return { error: "Payroll period not found." };
    if (period.status !== "DRAFT") return { error: "This period is finalized. Add a new period for someone who was missed." };
    const employee = await db.employee.findUnique({ where: { id: employeeId }, select: { status: true } });
    if (!employee || employee.status !== "ACTIVE") return { error: "Choose an active employee." };

    const created = await db.payrollRecord.create({
      data: {
        employeeId,
        payrollPeriodId: periodId,
        totalWorkingDays: "0.00",
        paidDays: "0.00",
        lopDays: "0.00",
        basicSalary: "0.00",
        hra: "0.00",
        specialAllowance: "0.00",
        otherAllowances: "0.00",
        grossEarnings: "0.00",
        totalDeductions: "0.00",
        netPay: "0.00",
        createdById: actor.id,
        updatedById: actor.id,
      },
      select: { id: true },
    });
    await db.auditLog.create({
      data: {
        actorId: actor.id,
        action: "payroll.create",
        targetType: "payroll_record",
        targetId: created.id,
        requestId: crypto.randomUUID(),
        metadata: { periodId },
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "This employee already has a payslip for that period." };
    }
    logFailure("payroll.add", error);
    return { error: "Something went wrong. Try again." };
  }

  revalidatePath(`/payroll/${periodId}`);
  return { error: null };
}

export async function savePayrollEntry(
  _state: PayrollFormState,
  formData: FormData,
): Promise<PayrollFormState> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { ...emptyState, error: blocked };
  const actor = await requireRole(staff);
  const parsed = payrollEntrySchema.safeParse(payrollEntryFormData(formData));
  if (!parsed.success) return { ...emptyState, error: issue(parsed.error) };

  const previewOnly = formData.get("intent") === "preview";
  try {
    const db = getDb();
    const record = await db.payrollRecord.findUnique({
      where: { id: parsed.data.recordId },
      select: { id: true, status: true, payrollPeriodId: true },
    });
    if (!record) return { ...emptyState, error: "Payslip not found." };
    if (record.status !== "DRAFT") return { ...emptyState, error: "This payslip can no longer be edited." };

    const company = await db.companySettings.findUnique({
      where: { id: 1 },
      select: { currency: true, includeBonus: true, includeOvertime: true },
    });
    const currency = company?.currency || "INR";
    const input = {
      ...parsed.data,
      overtime: company?.includeOvertime ? parsed.data.overtime : null,
      bonus: company?.includeBonus ? parsed.data.bonus : null,
    };
    const totals = calculatePayroll(input, currency);
    const preview = {
      gross: formatMoney(totals.grossEarnings, currency),
      deductions: formatMoney(totals.totalDeductions, currency),
      net: formatMoney(totals.netPay, currency),
      words: totals.amountInWords,
    };
    if (previewOnly) return { error: null, saved: false, warnings: totals.errors, preview };

    await db.payrollRecord.update({
      where: { id: record.id, status: "DRAFT" },
      data: {
        totalWorkingDays: input.totalWorkingDays.toFixed(2),
        paidDays: input.paidDays.toFixed(2),
        lopDays: input.lopDays.toFixed(2),
        basicSalary: input.basicSalary.toFixed(2),
        hra: input.hra.toFixed(2),
        specialAllowance: input.specialAllowance.toFixed(2),
        otherAllowances: input.otherAllowances.toFixed(2),
        overtime: input.overtime?.toFixed(2) ?? null,
        bonus: input.bonus?.toFixed(2) ?? null,
        grossEarnings: totals.grossEarnings.toFixed(2),
        employeePf: input.employeePf?.toFixed(2) ?? null,
        employeeEsi: input.employeeEsi?.toFixed(2) ?? null,
        professionalTax: input.professionalTax?.toFixed(2) ?? null,
        tds: input.tds?.toFixed(2) ?? null,
        salaryAdvance: input.salaryAdvance?.toFixed(2) ?? null,
        otherDeductions: input.otherDeductions?.toFixed(2) ?? null,
        totalDeductions: totals.totalDeductions.toFixed(2),
        netPay: totals.netPay.toFixed(2),
        amountInWords: totals.amountInWords,
        currency,
        updatedById: actor.id,
      },
    });
    await db.auditLog.create({
      data: {
        actorId: actor.id,
        action: "payroll.update",
        targetType: "payroll_record",
        targetId: record.id,
        requestId: crypto.randomUUID(),
        metadata: { fields: ["components"] },
      },
    });
    revalidatePath(`/payroll/${record.payrollPeriodId}`);
    revalidatePath(`/payroll/${record.payrollPeriodId}/${record.id}`);
    return { error: null, saved: true, warnings: totals.errors, preview };
  } catch (error) {
    unstable_rethrow(error);
    logFailure("payroll.save", error);
    return { ...emptyState, error: "Something went wrong. Try again." };
  }
}
