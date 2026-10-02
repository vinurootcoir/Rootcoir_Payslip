"use server";

import { logFailure } from "@/lib/log";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireRole } from "@/server/auth/guard";
import { mutationGuard } from "@/server/auth/request";
import { getDb } from "@/server/db";
import { calculatePayroll, type PayrollInput } from "./calculate";
import { buildSnapshot, snapshotJson } from "./snapshot";

const staff = ["SUPER_ADMIN", "ADMIN"] as const;

export type FinalizeState = { error: string | null; details: string[] };

function asComponents(row: {
  totalWorkingDays: Prisma.Decimal;
  paidDays: Prisma.Decimal;
  lopDays: Prisma.Decimal;
  basicSalary: Prisma.Decimal;
  hra: Prisma.Decimal;
  specialAllowance: Prisma.Decimal;
  otherAllowances: Prisma.Decimal;
  overtime: Prisma.Decimal | null;
  bonus: Prisma.Decimal | null;
  employeePf: Prisma.Decimal | null;
  employeeEsi: Prisma.Decimal | null;
  professionalTax: Prisma.Decimal | null;
  tds: Prisma.Decimal | null;
  salaryAdvance: Prisma.Decimal | null;
  otherDeductions: Prisma.Decimal | null;
}): PayrollInput {
  return row;
}

async function nextPayslipNumber(
  tx: Prisma.TransactionClient,
  year: number,
  month: number,
): Promise<string> {
  const prefix = `PS${year}${String(month).padStart(2, "0")}`;
  const latest = await tx.payrollRecord.findFirst({
    where: { payslipNumber: { startsWith: prefix } },
    orderBy: { payslipNumber: "desc" },
    select: { payslipNumber: true },
  });
  const sequence = Number(latest?.payslipNumber?.slice(prefix.length) ?? "0");
  const next = Number.isFinite(sequence) ? sequence + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export async function finalizePayrollPeriod(
  _state: FinalizeState,
  formData: FormData,
): Promise<FinalizeState> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { error: blocked, details: [] };
  const actor = await requireRole(staff);
  if (formData.get("confirm") !== "on") {
    return { error: "Confirm that this period should be finalized.", details: [] };
  }
  const periodId = String(formData.get("periodId") ?? "");

  try {
    const db = getDb();
    await db.$transaction(async (tx) => {
      const period = await tx.payrollPeriod.findUnique({
        where: { id: periodId },
        select: { id: true, year: true, month: true, status: true },
      });
      if (!period || period.status !== "DRAFT") {
        throw new Error("PERIOD_LOCKED");
      }
      const company = await tx.companySettings.findUnique({
        where: { id: 1 },
        select: { name: true, address: true, currency: true },
      });
      if (!company?.name || !company.address) {
        throw new Error("COMPANY_MISSING");
      }
      const drafts = await tx.payrollRecord.findMany({
        where: { payrollPeriodId: period.id, status: "DRAFT" },
        select: {
          id: true,
          totalWorkingDays: true,
          paidDays: true,
          lopDays: true,
          casualLeaveDays: true,
          sickLeaveDays: true,
          basicSalary: true,
          hra: true,
          specialAllowance: true,
          otherAllowances: true,
          overtime: true,
          bonus: true,
          employeePf: true,
          employeeEsi: true,
          professionalTax: true,
          tds: true,
          salaryAdvance: true,
          otherDeductions: true,
          employee: {
            select: {
              fullName: true,
              employeeNumber: true,
              designation: true,
              department: true,
              dateOfJoining: true,
              pan: true,
              uan: true,
              esiNumber: true,
            },
          },
        },
      });
      if (drafts.length === 0) throw new Error("EMPTY_PERIOD");

      const problems = drafts.flatMap((row) => {
        const totals = calculatePayroll(asComponents(row), company.currency);
        return totals.errors.map((error) => `${row.employee.fullName}: ${error}`);
      });
      if (problems.length > 0) throw new Error(`INVALID:${problems.join("\n")}`);

      for (const row of drafts) {
        const payslipNumber = await nextPayslipNumber(tx, period.year, period.month);
        const components = asComponents(row);
        const totals = calculatePayroll(components, company.currency);
        const snapshot = buildSnapshot({
          company,
          employee: row.employee,
          components,
          payslipNumber,
          leave: { casualLeaveDays: row.casualLeaveDays, sickLeaveDays: row.sickLeaveDays },
        });
        await tx.payrollRecord.update({
          where: { id: row.id, status: "DRAFT" },
          data: {
            status: "FINALIZED",
            payslipNumber,
            grossEarnings: totals.grossEarnings.toFixed(2),
            totalDeductions: totals.totalDeductions.toFixed(2),
            netPay: totals.netPay.toFixed(2),
            amountInWords: totals.amountInWords,
            currency: company.currency,
            snapshot: snapshotJson(snapshot),
            finalizedAt: new Date(),
            finalizedById: actor.id,
          },
        });
      }

      await tx.payrollPeriod.update({
        where: { id: period.id, status: "DRAFT" },
        data: { status: "FINALIZED", finalizedAt: new Date(), finalizedById: actor.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "payroll.finalize",
          targetType: "payroll_period",
          targetId: period.id,
          requestId: crypto.randomUUID(),
          metadata: { count: drafts.length },
        },
      });
    }, { timeout: 20000 });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Error && error.message === "PERIOD_LOCKED") {
      return { error: "This period is already finalized.", details: [] };
    }
    if (error instanceof Error && error.message === "COMPANY_MISSING") {
      return { error: "Add the company name and address before finalizing.", details: [] };
    }
    if (error instanceof Error && error.message === "EMPTY_PERIOD") {
      return { error: "Add at least one employee before finalizing.", details: [] };
    }
    if (error instanceof Error && error.message.startsWith("INVALID:")) {
      return { error: "Fix these payslips before finalizing.", details: error.message.slice("INVALID:".length).split("\n") };
    }
    logFailure("payroll.finalize", error);
    return { error: "Something went wrong. Try again.", details: [] };
  }

  revalidatePath(`/payroll/${periodId}`);
  redirect(`/payroll/${periodId}`);
}

export async function voidAndReissue(
  _state: FinalizeState,
  formData: FormData,
): Promise<FinalizeState> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { error: blocked, details: [] };
  const actor = await requireRole(staff);
  if (formData.get("confirm") !== "on") {
    return { error: "Confirm the void and reissue.", details: [] };
  }
  const recordId = String(formData.get("recordId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5 || reason.length > 500) {
    return { error: "Enter a reason between 5 and 500 characters.", details: [] };
  }

  let nextId = "";
  let periodId = "";
  try {
    const created = await getDb().$transaction(async (tx) => {
      const current = await tx.payrollRecord.findUnique({
        where: { id: recordId },
        select: {
          id: true,
          status: true,
          revision: true,
          employeeId: true,
          payrollPeriodId: true,
          currency: true,
          totalWorkingDays: true,
          paidDays: true,
          lopDays: true,
          casualLeaveDays: true,
          sickLeaveDays: true,
          basicSalary: true,
          hra: true,
          specialAllowance: true,
          otherAllowances: true,
          overtime: true,
          bonus: true,
          employeePf: true,
          employeeEsi: true,
          professionalTax: true,
          tds: true,
          salaryAdvance: true,
          otherDeductions: true,
        },
      });
      if (!current || current.status !== "FINALIZED") throw new Error("NOT_FINAL");
      const openReplacement = await tx.payrollRecord.findFirst({
        where: { supersedesId: current.id, status: { not: "VOID" } },
        select: { id: true },
      });
      if (openReplacement) throw new Error("ALREADY_REISSUED");

      await tx.payrollRecord.update({
        where: { id: current.id, status: "FINALIZED" },
        data: { status: "VOID", voidReason: reason, voidedAt: new Date(), voidedById: actor.id },
      });
      const replacement = await tx.payrollRecord.create({
        data: {
          employeeId: current.employeeId,
          payrollPeriodId: current.payrollPeriodId,
          revision: current.revision + 1,
          supersedesId: current.id,
          currency: current.currency,
          totalWorkingDays: current.totalWorkingDays,
          paidDays: current.paidDays,
          lopDays: current.lopDays,
          casualLeaveDays: current.casualLeaveDays,
          sickLeaveDays: current.sickLeaveDays,
          basicSalary: current.basicSalary,
          hra: current.hra,
          specialAllowance: current.specialAllowance,
          otherAllowances: current.otherAllowances,
          overtime: current.overtime,
          bonus: current.bonus,
          grossEarnings: "0.00",
          employeePf: current.employeePf,
          employeeEsi: current.employeeEsi,
          professionalTax: current.professionalTax,
          tds: current.tds,
          salaryAdvance: current.salaryAdvance,
          otherDeductions: current.otherDeductions,
          totalDeductions: "0.00",
          netPay: "0.00",
          createdById: actor.id,
          updatedById: actor.id,
        },
        select: { id: true, payrollPeriodId: true },
      });
      const totals = calculatePayroll(asComponents(current), current.currency);
      await tx.payrollRecord.update({
        where: { id: replacement.id },
        data: {
          grossEarnings: totals.grossEarnings.toFixed(2),
          totalDeductions: totals.totalDeductions.toFixed(2),
          netPay: totals.netPay.toFixed(2),
          amountInWords: totals.amountInWords,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "payroll.void",
          targetType: "payroll_record",
          targetId: current.id,
          requestId: crypto.randomUUID(),
          metadata: { replacementId: replacement.id },
        },
      });
      return replacement;
    });
    nextId = created.id;
    periodId = created.payrollPeriodId;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Error && error.message === "NOT_FINAL") {
      return { error: "Only a finalized payslip can be voided.", details: [] };
    }
    if (error instanceof Error && error.message === "ALREADY_REISSUED") {
      return { error: "A replacement draft already exists.", details: [] };
    }
    logFailure("payroll.void", error);
    return { error: "Something went wrong. Try again.", details: [] };
  }

  revalidatePath(`/payroll/${periodId}`);
  redirect(`/payroll/${periodId}/${nextId}`);
}

export async function finalizeRevision(
  _state: FinalizeState,
  formData: FormData,
): Promise<FinalizeState> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { error: blocked, details: [] };
  const actor = await requireRole(staff);
  if (formData.get("confirm") !== "on") {
    return { error: "Confirm that this revision should be finalized.", details: [] };
  }
  const recordId = String(formData.get("recordId") ?? "");
  let periodId = "";

  try {
    await getDb().$transaction(async (tx) => {
      const row = await tx.payrollRecord.findUnique({
        where: { id: recordId },
        select: {
          id: true,
          status: true,
          payrollPeriodId: true,
          totalWorkingDays: true,
          paidDays: true,
          lopDays: true,
          casualLeaveDays: true,
          sickLeaveDays: true,
          basicSalary: true,
          hra: true,
          specialAllowance: true,
          otherAllowances: true,
          overtime: true,
          bonus: true,
          employeePf: true,
          employeeEsi: true,
          professionalTax: true,
          tds: true,
          salaryAdvance: true,
          otherDeductions: true,
          payrollPeriod: { select: { id: true, year: true, month: true, status: true } },
          employee: {
            select: {
              fullName: true,
              employeeNumber: true,
              designation: true,
              department: true,
              dateOfJoining: true,
              pan: true,
              uan: true,
              esiNumber: true,
            },
          },
        },
      });
      if (!row || row.status !== "DRAFT" || row.payrollPeriod.status !== "FINALIZED") {
        throw new Error("NOT_REVISION");
      }
      const company = await tx.companySettings.findUnique({
        where: { id: 1 },
        select: { name: true, address: true, currency: true },
      });
      if (!company?.name || !company.address) throw new Error("COMPANY_MISSING");
      const totals = calculatePayroll(asComponents(row), company.currency);
      if (totals.errors.length > 0) throw new Error(`INVALID:${totals.errors.join("\n")}`);
      const payslipNumber = await nextPayslipNumber(tx, row.payrollPeriod.year, row.payrollPeriod.month);
      const snapshot = buildSnapshot({
        company,
        employee: row.employee,
        components: asComponents(row),
        payslipNumber,
        leave: { casualLeaveDays: row.casualLeaveDays, sickLeaveDays: row.sickLeaveDays },
      });
      await tx.payrollRecord.update({
        where: { id: row.id, status: "DRAFT" },
        data: {
          status: "FINALIZED",
          payslipNumber,
          grossEarnings: totals.grossEarnings.toFixed(2),
          totalDeductions: totals.totalDeductions.toFixed(2),
          netPay: totals.netPay.toFixed(2),
          amountInWords: totals.amountInWords,
          currency: company.currency,
          snapshot: snapshotJson(snapshot),
          finalizedAt: new Date(),
          finalizedById: actor.id,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "payroll.finalize",
          targetType: "payroll_record",
          targetId: row.id,
          requestId: crypto.randomUUID(),
          metadata: { revision: true },
        },
      });
      periodId = row.payrollPeriodId;
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Error && error.message === "NOT_REVISION") {
      return { error: "This draft is finalized with its payroll period.", details: [] };
    }
    if (error instanceof Error && error.message === "COMPANY_MISSING") {
      return { error: "Add the company name and address before finalizing.", details: [] };
    }
    if (error instanceof Error && error.message.startsWith("INVALID:")) {
      return { error: "Fix this payslip before finalizing.", details: error.message.slice("INVALID:".length).split("\n") };
    }
    logFailure("payroll.revision", error);
    return { error: "Something went wrong. Try again.", details: [] };
  }

  revalidatePath(`/payroll/${periodId}`);
  redirect(`/payroll/${periodId}/${recordId}`);
}
