import assert from "node:assert/strict";
import test from "node:test";
import Decimal from "decimal.js";
import { amountInWords } from "../src/lib/amount-in-words";
import { sumMoney } from "../src/lib/money";
import { calculatePayroll, type PayrollInput } from "../src/server/payroll/calculate";
import { payrollEntrySchema } from "../src/server/payroll/schema";
import { buildSnapshot } from "../src/server/payroll/snapshot";

function entry(overrides: Record<string, string> = {}) {
  return {
    recordId: "11111111-1111-4111-8111-111111111111",
    totalWorkingDays: "26",
    paidDays: "26",
    lopDays: "0",
    basicSalary: "1000",
    hra: "0",
    specialAllowance: "0",
    otherAllowances: "0",
    overtime: "",
    bonus: "",
    employeePf: "",
    employeeEsi: "",
    professionalTax: "",
    tds: "",
    salaryAdvance: "",
    otherDeductions: "",
    ...overrides,
  };
}

function components(overrides: Partial<PayrollInput> = {}): PayrollInput {
  const zero = new Decimal(0);
  return {
    totalWorkingDays: new Decimal(26),
    paidDays: new Decimal(26),
    lopDays: zero,
    basicSalary: new Decimal(1000),
    hra: zero,
    specialAllowance: zero,
    otherAllowances: zero,
    overtime: null,
    bonus: null,
    employeePf: null,
    employeeEsi: null,
    professionalTax: null,
    tds: null,
    salaryAdvance: null,
    otherDeductions: null,
    ...overrides,
  };
}

test("money sums round each value half-up before the total", () => {
  assert.equal(sumMoney(["1.005", "1.005"]).toFixed(2), "2.02");
});

test("attendance overflow and a negative net are rejected before finalization", () => {
  const overflow = calculatePayroll(components({ paidDays: new Decimal(20), lopDays: new Decimal(10) }));
  assert.equal(overflow.errors.includes("Paid days and absent days cannot exceed total working days."), true);
  const negative = calculatePayroll(components({ basicSalary: new Decimal(100), employeePf: new Decimal(250) }));
  assert.equal(negative.netPay.toFixed(2), "-150.00");
  assert.equal(negative.errors.includes("Net pay cannot be negative."), true);
});

test("LOP deducts one thirtieth of monthly salary per absent day", () => {
  const result = calculatePayroll(
    components({
      basicSalary: new Decimal(20000),
      hra: new Decimal(8000),
      specialAllowance: new Decimal(2000),
      paidDays: new Decimal(23),
      lopDays: new Decimal(3),
      totalWorkingDays: new Decimal(26),
    }),
  );
  // Monthly salary 30000 → 30000/30 × 3 = 3000
  assert.equal(result.monthlySalary.toFixed(2), "30000.00");
  assert.equal(result.lopDeduction.toFixed(2), "3000.00");
  assert.equal(result.grossEarnings.toFixed(2), "30000.00");
  assert.equal(result.totalDeductions.toFixed(2), "3000.00");
  assert.equal(result.netPay.toFixed(2), "27000.00");
  assert.deepEqual(result.errors, []);
});

test("LOP ignores overtime and bonus when computing the daily rate", () => {
  const result = calculatePayroll(
    components({
      basicSalary: new Decimal(30000),
      overtime: new Decimal(3000),
      bonus: new Decimal(1500),
      lopDays: new Decimal(1),
      paidDays: new Decimal(25),
      totalWorkingDays: new Decimal(26),
    }),
  );
  assert.equal(result.lopDeduction.toFixed(2), "1000.00");
  assert.equal(result.grossEarnings.toFixed(2), "34500.00");
  assert.equal(result.netPay.toFixed(2), "33500.00");
});

test("Indian amount in words uses crore and lakh", () => {
  assert.equal(
    amountInWords("1234567.5"),
    "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees and Fifty Paise Only",
  );
  assert.equal(amountInWords(0), "Zero Rupees Only");
  assert.equal(amountInWords("0.5"), "Zero Rupees and Fifty Paise Only");
  assert.equal(amountInWords("-2"), "Minus Two Rupees Only");
});

test("payroll entry rejects more than 31 days and a blank required amount", () => {
  assert.equal(payrollEntrySchema.safeParse(entry({ totalWorkingDays: "32" })).success, false);
  assert.equal(payrollEntrySchema.safeParse(entry({ basicSalary: "" })).success, false);
  assert.equal(payrollEntrySchema.safeParse(entry()).success, true);
});

test("a snapshot keeps the calculated net after the draft values change", () => {
  const company = { name: "Root Coir", address: "Kerala", currency: "INR" };
  const employee = {
    fullName: "Asha",
    employeeNumber: "E001",
    designation: "Operator",
    department: "Plant",
    dateOfJoining: new Date("2020-01-15T00:00:00.000Z"),
    pan: "ABCDE1234F",
    uan: null,
    esiNumber: null,
  };
  const figures = components({ basicSalary: new Decimal("1000.005"), hra: new Decimal("1.005") });
  const snapshot = buildSnapshot({
    company,
    employee,
    components: figures,
    payslipNumber: "PS2026100001",
  });
  figures.basicSalary = new Decimal(9);
  company.name = "Changed";
  employee.fullName = "Changed";
  assert.equal(snapshot.netPay, "1001.02");
  assert.equal(snapshot.amountInWords, amountInWords("1001.02"));
  assert.equal(snapshot.company.name, "Root Coir");
  assert.equal(snapshot.employee.fullName, "Asha");
  assert.equal(snapshot.payslipNumber, "PS2026100001");
});
