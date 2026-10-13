import Decimal from "decimal.js";
import { amountInWords } from "@/lib/amount-in-words";
import { sumMoney, toDays, toMoney } from "@/lib/money";

/** Calendar-month divisor for LOP: each absent day deducts 1/30 of monthly salary. */
export const LOP_DAY_DIVISOR = 30;

export type PayrollInput = {
  totalWorkingDays: Decimal;
  paidDays: Decimal;
  lopDays: Decimal;
  basicSalary: Decimal;
  hra: Decimal;
  specialAllowance: Decimal;
  otherAllowances: Decimal;
  overtime: Decimal | null;
  bonus: Decimal | null;
  employeePf: Decimal | null;
  employeeEsi: Decimal | null;
  professionalTax: Decimal | null;
  tds: Decimal | null;
  salaryAdvance: Decimal | null;
  otherDeductions: Decimal | null;
};

export type PayrollTotals = {
  monthlySalary: Decimal;
  lopDeduction: Decimal;
  grossEarnings: Decimal;
  totalDeductions: Decimal;
  netPay: Decimal;
  amountInWords: string;
  errors: string[];
};

function present(values: Array<Decimal | null>): Decimal[] {
  return values.filter((value): value is Decimal => value !== null);
}

/** Fixed monthly salary used for LOP (excludes overtime and bonus). */
export function monthlySalaryTotal(input: Pick<
  PayrollInput,
  "basicSalary" | "hra" | "specialAllowance" | "otherAllowances"
>): Decimal {
  return sumMoney([
    input.basicSalary,
    input.hra,
    input.specialAllowance,
    input.otherAllowances,
  ]);
}

/** LOP amount = monthly salary × lopDays / 30. */
export function lopDeductionAmount(input: Pick<
  PayrollInput,
  "basicSalary" | "hra" | "specialAllowance" | "otherAllowances" | "lopDays"
>): Decimal {
  const days = toDays(input.lopDays);
  if (days.isZero()) return toMoney(0);
  return toMoney(monthlySalaryTotal(input).div(LOP_DAY_DIVISOR).times(days));
}

export function calculatePayroll(input: PayrollInput, currency = "INR"): PayrollTotals {
  const monthlySalary = monthlySalaryTotal(input);
  const lopDeduction = lopDeductionAmount(input);
  const grossEarnings = sumMoney(
    present([
      input.basicSalary,
      input.hra,
      input.specialAllowance,
      input.otherAllowances,
      input.overtime,
      input.bonus,
    ]),
  );
  const totalDeductions = sumMoney(
    present([
      input.employeePf,
      input.employeeEsi,
      input.professionalTax,
      input.tds,
      input.salaryAdvance,
      input.otherDeductions,
      lopDeduction.isZero() ? null : lopDeduction,
    ]),
  );
  const netPay = toMoney(grossEarnings.minus(totalDeductions));
  const errors: string[] = [];
  if (toDays(input.paidDays.plus(input.lopDays)).gt(toDays(input.totalWorkingDays))) {
    errors.push("Paid days and absent days cannot exceed total working days.");
  }
  if (netPay.isNeg()) {
    errors.push("Net pay cannot be negative.");
  }
  return {
    monthlySalary,
    lopDeduction,
    grossEarnings,
    totalDeductions,
    netPay,
    amountInWords: amountInWords(netPay, currency),
    errors,
  };
}
