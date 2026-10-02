import Decimal from "decimal.js";
import { amountInWords } from "@/lib/amount-in-words";
import { sumMoney, toDays, toMoney } from "@/lib/money";

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
  grossEarnings: Decimal;
  totalDeductions: Decimal;
  netPay: Decimal;
  amountInWords: string;
  errors: string[];
};

function present(values: Array<Decimal | null>): Decimal[] {
  return values.filter((value): value is Decimal => value !== null);
}

export function calculatePayroll(input: PayrollInput, currency = "INR"): PayrollTotals {
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
    grossEarnings,
    totalDeductions,
    netPay,
    amountInWords: amountInWords(netPay, currency),
    errors,
  };
}
