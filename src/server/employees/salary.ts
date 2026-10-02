import Decimal from "decimal.js";
import { calculatePayroll } from "@/server/payroll/calculate";
import { toDays, toMoney } from "@/lib/money";

export type SalaryShape = {
  basicSalary: Decimal.Value;
  hra: Decimal.Value;
  specialAllowance: Decimal.Value;
  otherAllowances: Decimal.Value;
  employeePf: Decimal.Value;
  employeeEsi: Decimal.Value;
  professionalTax: Decimal.Value;
  tds: Decimal.Value;
};

export type DraftExtras = {
  totalWorkingDays?: Decimal.Value;
  paidDays?: Decimal.Value;
  lopDays?: Decimal.Value;
  overtime?: Decimal.Value | null;
  bonus?: Decimal.Value | null;
  salaryAdvance?: Decimal.Value | null;
  otherDeductions?: Decimal.Value | null;
};

function storedOptional(value: Decimal.Value | null | undefined): Decimal | null {
  if (value == null) return null;
  return toMoney(value);
}

function structureDeduction(value: Decimal.Value): Decimal | null {
  const money = toMoney(value);
  return money.isZero() ? null : money;
}

export function payslipAmounts(salary: SalaryShape, currency: string, extras: DraftExtras = {}) {
  const input = {
    totalWorkingDays: toDays(extras.totalWorkingDays ?? 0),
    paidDays: toDays(extras.paidDays ?? 0),
    lopDays: toDays(extras.lopDays ?? 0),
    basicSalary: toMoney(salary.basicSalary),
    hra: toMoney(salary.hra),
    specialAllowance: toMoney(salary.specialAllowance),
    otherAllowances: toMoney(salary.otherAllowances),
    overtime: storedOptional(extras.overtime),
    bonus: storedOptional(extras.bonus),
    employeePf: structureDeduction(salary.employeePf),
    employeeEsi: structureDeduction(salary.employeeEsi),
    professionalTax: structureDeduction(salary.professionalTax),
    tds: structureDeduction(salary.tds),
    salaryAdvance: storedOptional(extras.salaryAdvance),
    otherDeductions: storedOptional(extras.otherDeductions),
  };
  const totals = calculatePayroll(input, currency);
  return {
    basicSalary: input.basicSalary.toFixed(2),
    hra: input.hra.toFixed(2),
    specialAllowance: input.specialAllowance.toFixed(2),
    otherAllowances: input.otherAllowances.toFixed(2),
    employeePf: input.employeePf?.toFixed(2) ?? null,
    employeeEsi: input.employeeEsi?.toFixed(2) ?? null,
    professionalTax: input.professionalTax?.toFixed(2) ?? null,
    tds: input.tds?.toFixed(2) ?? null,
    grossEarnings: totals.grossEarnings.toFixed(2),
    totalDeductions: totals.totalDeductions.toFixed(2),
    netPay: totals.netPay.toFixed(2),
    amountInWords: totals.amountInWords,
    errors: totals.errors,
  };
}

export function salaryFieldValues(salary: SalaryShape) {
  return {
    basicSalary: toMoney(salary.basicSalary).toFixed(2),
    hra: toMoney(salary.hra).toFixed(2),
    specialAllowance: toMoney(salary.specialAllowance).toFixed(2),
    otherAllowances: toMoney(salary.otherAllowances).toFixed(2),
    employeePf: toMoney(salary.employeePf).toFixed(2),
    employeeEsi: toMoney(salary.employeeEsi).toFixed(2),
    professionalTax: toMoney(salary.professionalTax).toFixed(2),
    tds: toMoney(salary.tds).toFixed(2),
  };
}
