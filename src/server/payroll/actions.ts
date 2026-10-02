"use server";

import { logFailure } from "@/lib/log";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireRole } from "@/server/auth/guard";
import { mutationGuard } from "@/server/auth/request";
import { payslipAmounts, type SalaryShape } from "@/server/employees/salary";
import { getDb } from "@/server/db";
import { formatMoney } from "@/lib/money";
import {
  ATTENDANCE_BYTE_LIMIT,
  parseAttendanceSheet,
  type AttendanceSheetError,
  type AttendanceSheetRow,
} from "./attendance-sheet";
import { calculatePayroll } from "./calculate";
import { attendanceDaysSchema, payrollEntryFormData, payrollEntrySchema } from "./schema";

const staff = ["SUPER_ADMIN", "ADMIN"] as const;

const salarySelect = {
  basicSalary: true,
  hra: true,
  specialAllowance: true,
  otherAllowances: true,
  employeePf: true,
  employeeEsi: true,
  professionalTax: true,
  tds: true,
} as const;

function draftMoney(salary: SalaryShape, currency: string) {
  const amounts = payslipAmounts(salary, currency);
  return {
    basicSalary: amounts.basicSalary,
    hra: amounts.hra,
    specialAllowance: amounts.specialAllowance,
    otherAllowances: amounts.otherAllowances,
    employeePf: amounts.employeePf,
    employeeEsi: amounts.employeeEsi,
    professionalTax: amounts.professionalTax,
    tds: amounts.tds,
    grossEarnings: amounts.grossEarnings,
    totalDeductions: amounts.totalDeductions,
    netPay: amounts.netPay,
    amountInWords: amounts.amountInWords,
    currency,
  };
}

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
    const employee = await db.employee.findUnique({ where: { id: employeeId }, select: { status: true, ...salarySelect } });
    if (!employee || employee.status !== "ACTIVE") return { error: "Choose an active employee." };
    const company = await db.companySettings.findUnique({ where: { id: 1 }, select: { currency: true } });

    const created = await db.payrollRecord.create({
      data: {
        employeeId,
        payrollPeriodId: periodId,
        totalWorkingDays: "0.00",
        paidDays: "0.00",
        lopDays: "0.00",
        ...draftMoney(employee, company?.currency || "INR"),
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

export async function addEmployeesToPeriod(
  _state: { error: string | null; added: number },
  formData: FormData,
): Promise<{ error: string | null; added: number }> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { error: blocked, added: 0 };
  const actor = await requireRole(staff);
  const periodId = String(formData.get("periodId") ?? "");
  const mode = String(formData.get("mode") ?? "");
  if (!periodId) return { error: "Payroll period not found.", added: 0 };

  try {
    const db = getDb();
    const period = await db.payrollPeriod.findUnique({ where: { id: periodId }, select: { status: true } });
    if (!period) return { error: "Payroll period not found.", added: 0 };
    if (period.status !== "DRAFT") {
      return { error: "This period is finalized. Add a new period for someone who was missed.", added: 0 };
    }

    const existing = await db.payrollRecord.findMany({
      where: { payrollPeriodId: periodId, status: { not: "VOID" } },
      select: { employeeId: true },
    });
    const taken = new Set(existing.map((row) => row.employeeId));
    const where = mode === "all-active"
      ? { status: "ACTIVE" as const, id: { notIn: [...taken] } }
      : { id: { in: formData.getAll("employeeId").filter((value): value is string => typeof value === "string" && value.length > 0) } };
    if (mode !== "all-active" && mode !== "selected") return { error: "Choose at least one employee.", added: 0 };

    const employees = await db.employee.findMany({
      where,
      select: { id: true, ...salarySelect },
      take: 500,
    });
    const chosen = employees.filter((employee) => !taken.has(employee.id));
    if (chosen.length === 0) return { error: "Choose at least one employee who is not already on this period.", added: 0 };
    const company = await db.companySettings.findUnique({ where: { id: 1 }, select: { currency: true } });
    const currency = company?.currency || "INR";

    await db.$transaction(async (tx) => {
      await tx.payrollRecord.createMany({
        data: chosen.map((employee) => ({
          employeeId: employee.id,
          payrollPeriodId: periodId,
          totalWorkingDays: "0.00",
          paidDays: "0.00",
          lopDays: "0.00",
          ...draftMoney(employee, currency),
          createdById: actor.id,
          updatedById: actor.id,
        })),
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "payroll.create",
          targetType: "payroll_period",
          targetId: periodId,
          requestId: crypto.randomUUID(),
          metadata: { count: chosen.length },
        },
      });
    });
    revalidatePath(`/payroll/${periodId}`);
    revalidatePath("/payroll");
    return { error: null, added: chosen.length };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "One of those employees already has a payslip for that period.", added: 0 };
    }
    logFailure("payroll.add", error);
    return { error: "Something went wrong. Try again.", added: 0 };
  }
}

export async function saveAttendance(
  _state: { error: string | null; saved: boolean },
  formData: FormData,
): Promise<{ error: string | null; saved: boolean }> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { error: blocked, saved: false };
  const actor = await requireRole(staff);
  const recordId = String(formData.get("recordId") ?? "");
  const parsed = attendanceDaysSchema.safeParse({
    totalWorkingDays: formData.get("totalWorkingDays"),
    paidDays: formData.get("paidDays"),
    lopDays: formData.get("lopDays"),
    casualLeaveDays: formData.get("casualLeaveDays"),
    sickLeaveDays: formData.get("sickLeaveDays"),
  });
  if (!parsed.success) return { error: issue(parsed.error), saved: false };

  try {
    const updated = await getDb().payrollRecord.updateMany({
      where: { id: recordId, status: "DRAFT" },
      data: {
        totalWorkingDays: parsed.data.totalWorkingDays.toFixed(2),
        paidDays: parsed.data.paidDays.toFixed(2),
        lopDays: parsed.data.lopDays.toFixed(2),
        casualLeaveDays: parsed.data.casualLeaveDays.toFixed(2),
        sickLeaveDays: parsed.data.sickLeaveDays.toFixed(2),
        updatedById: actor.id,
      },
    });
    if (updated.count !== 1) return { error: "Attendance can only be changed on a draft payslip.", saved: false };
  } catch (error) {
    unstable_rethrow(error);
    logFailure("payroll.attendance", error);
    return { error: "Something went wrong. Try again.", saved: false };
  }

  revalidatePath("/employees", "layout");
  revalidatePath("/payroll", "layout");
  return { error: null, saved: true };
}

export type AttendanceImportState = {
  error: string | null;
  errors: AttendanceSheetError[];
  updated: number;
};

export async function importAttendanceSheet(formData: FormData): Promise<AttendanceImportState> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { error: blocked, errors: [], updated: 0 };
  const actor = await requireRole(staff);
  const file = await attendanceWorkbook(formData);
  if ("error" in file) return { error: file.error, errors: [], updated: 0 };

  let parsed: { rows: AttendanceSheetRow[]; errors: AttendanceSheetError[] };
  try {
    parsed = await parseAttendanceSheet(file.bytes);
  } catch (error) {
    logFailure("payroll.attendance", error);
    return { error: "That Excel file could not be read.", errors: [], updated: 0 };
  }
  if (parsed.errors.length > 0) return { error: null, errors: parsed.errors, updated: 0 };

  try {
    const periodId = String(formData.get("periodId") ?? "");
    if (!periodId) return { error: "Open a payroll month before uploading attendance.", errors: [], updated: 0 };
    const updates = await matchAttendanceRows(parsed.rows, periodId);
    if (updates.errors.length > 0) return { error: null, errors: updates.errors, updated: 0 };
    await getDb().$transaction(async (tx) => {
      for (const row of updates.rows) {
        await tx.payrollRecord.updateMany({
          where: { id: row.recordId, status: "DRAFT" },
          data: {
            totalWorkingDays: row.totalWorkingDays,
            paidDays: row.paidDays,
            lopDays: row.lopDays,
            updatedById: actor.id,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "payroll.attendance",
          targetType: "payroll_record",
          requestId: crypto.randomUUID(),
          metadata: { count: updates.rows.length },
        },
      });
    });
    revalidatePath("/payroll", "layout");
    revalidatePath("/employees", "layout");
    return { error: null, errors: [], updated: updates.rows.length };
  } catch (error) {
    unstable_rethrow(error);
    logFailure("payroll.attendance", error);
    return { error: "Something went wrong. Try again.", errors: [], updated: 0 };
  }
}

async function matchAttendanceRows(
  rows: AttendanceSheetRow[],
  periodId: string,
): Promise<{
  rows: Array<AttendanceSheetRow & { recordId: string }>;
  errors: AttendanceSheetError[];
}> {
  const db = getDb();
  const target = await db.payrollPeriod.findUnique({
    where: { id: periodId },
    select: { id: true, year: true, month: true, status: true },
  });
  if (!target) return { rows: [], errors: [{ row: 1, message: "Payroll period not found." }] };
  if (target.status !== "DRAFT") {
    return { rows: [], errors: [{ row: 1, message: "This payroll period is finalized." }] };
  }
  const employees = await db.employee.findMany({
    where: { employeeNumber: { in: rows.map((row) => row.employeeNumber) } },
    select: { id: true, employeeNumber: true },
  });
  const byNumber = new Map(employees.map((employee) => [employee.employeeNumber, employee.id]));
  const periods = await db.payrollPeriod.findMany({
    where: { OR: rows.map((row) => ({ year: row.year, month: row.month })) },
    select: { id: true, year: true, month: true, status: true },
  });
  const periodKey = (year: number, month: number) => `${year}:${month}`;
  const byPeriod = new Map(periods.map((period) => [periodKey(period.year, period.month), period]));
  const records = await db.payrollRecord.findMany({
    where: {
      status: "DRAFT",
      employeeId: { in: employees.map((employee) => employee.id) },
      payrollPeriodId: { in: periods.map((period) => period.id) },
    },
    select: { id: true, employeeId: true, payrollPeriodId: true },
  });
  const byPair = new Map(records.map((record) => [`${record.employeeId}:${record.payrollPeriodId}`, record.id]));
  const errors: AttendanceSheetError[] = [];
  const matched: Array<AttendanceSheetRow & { recordId: string }> = [];
  for (const row of rows) {
    const employeeId = byNumber.get(row.employeeNumber);
    if (!employeeId) {
      errors.push({ row: row.row, message: "No employee has that employee number." });
      continue;
    }
    if (row.year !== target.year || row.month !== target.month) {
      errors.push({ row: row.row, message: "This row is for a different month." });
      continue;
    }
    const period = byPeriod.get(periodKey(row.year, row.month));
    if (!period || period.id !== target.id) {
      errors.push({ row: row.row, message: "There is no payroll period for that month." });
      continue;
    }
    const recordId = byPair.get(`${employeeId}:${period.id}`);
    if (!recordId) {
      errors.push({ row: row.row, message: "Add this employee to the draft payroll before uploading attendance." });
      continue;
    }
    matched.push({ ...row, recordId });
  }
  return { rows: matched, errors };
}

async function attendanceWorkbook(formData: FormData): Promise<{ bytes: Uint8Array } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an Excel file." };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "Upload an .xlsx file. Macro-enabled workbooks are not accepted." };
  if (file.size > ATTENDANCE_BYTE_LIMIT) return { error: "That file is too large." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return { error: "Upload an .xlsx file." };
  if (Buffer.from(bytes).includes(Buffer.from("vbaProject.bin"))) {
    return { error: "Macro-enabled workbooks are not accepted." };
  }
  return { bytes };
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
