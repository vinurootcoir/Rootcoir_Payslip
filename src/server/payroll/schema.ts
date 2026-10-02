import Decimal from "decimal.js";
import { z } from "zod";
import { toDays, toMoney } from "@/lib/money";

const MAX_MONEY = new Decimal("999999999999.99");

function requiredMoney(value: string, ctx: z.RefinementCtx, label: string): Decimal {
  if (!/^\d+(\.\d{1,4})?$/.test(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Enter ${label} as a number.` });
    return z.NEVER;
  }
  const money = toMoney(value);
  if (money.gt(MAX_MONEY)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is too large.` });
    return z.NEVER;
  }
  return money;
}

function optionalMoney(value: string, ctx: z.RefinementCtx, label: string): Decimal | null {
  if (value.trim() === "") return null;
  return requiredMoney(value.trim(), ctx, label);
}

function requiredDays(value: string, ctx: z.RefinementCtx, label: string): Decimal {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Enter ${label} as a number.` });
    return z.NEVER;
  }
  const days = toDays(value);
  if (days.gt(31)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} cannot be more than 31.` });
    return z.NEVER;
  }
  return days;
}

const text = (label: string) =>
  z.string().trim().transform((value, ctx) => requiredMoney(value, ctx, label));

const optional = (label: string) =>
  z.string().transform((value, ctx) => optionalMoney(value, ctx, label));

const days = (label: string) =>
  z.string().trim().transform((value, ctx) => requiredDays(value, ctx, label));

export const payrollEntrySchema = z.object({
  recordId: z.string().uuid(),
  totalWorkingDays: days("total working days"),
  paidDays: days("paid days"),
  lopDays: days("absent days"),
  basicSalary: text("basic salary"),
  hra: text("HRA"),
  specialAllowance: text("special allowance"),
  otherAllowances: text("other allowances"),
  overtime: optional("overtime"),
  bonus: optional("bonus"),
  employeePf: optional("employee PF"),
  employeeEsi: optional("employee ESI"),
  professionalTax: optional("professional tax"),
  tds: optional("TDS"),
  salaryAdvance: optional("salary advance"),
  otherDeductions: optional("other deductions"),
});

export type PayrollEntryInput = z.infer<typeof payrollEntrySchema>;

export function payrollEntryFormData(formData: FormData) {
  const read = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  return {
    recordId: read("recordId"),
    totalWorkingDays: read("totalWorkingDays"),
    paidDays: read("paidDays"),
    lopDays: read("lopDays"),
    basicSalary: read("basicSalary"),
    hra: read("hra"),
    specialAllowance: read("specialAllowance"),
    otherAllowances: read("otherAllowances"),
    overtime: read("overtime"),
    bonus: read("bonus"),
    employeePf: read("employeePf"),
    employeeEsi: read("employeeEsi"),
    professionalTax: read("professionalTax"),
    tds: read("tds"),
    salaryAdvance: read("salaryAdvance"),
    otherDeductions: read("otherDeductions"),
  };
}

export function moneyInput(value: { toFixed: (digits: number) => string } | null): string {
  return value ? value.toFixed(2) : "";
}
