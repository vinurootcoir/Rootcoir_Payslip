import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildAttendanceSampleWorkbook, parseAttendanceSheet } from "../src/server/payroll/attendance-sheet";
import { renderPayslipPdf } from "../src/server/payroll/pdf";
import { buildPayslipDocument } from "../src/server/payroll/payslip-document";
import type { PayslipSnapshot } from "../src/server/payroll/snapshot";

test("the attendance sample parses one row", async () => {
  const parsed = await parseAttendanceSheet(await buildAttendanceSampleWorkbook());
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]?.employeeNumber, "E1001");
  assert.equal(parsed.rows[0]?.year, 2026);
  assert.equal(parsed.rows[0]?.month, 4);
  assert.equal(parsed.rows[0]?.paidDays, "24.00");
  assert.equal(parsed.rows[0]?.lopDays, "2.00");
});

test("attendance rejects days that overflow and formulas", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendance");
  sheet.addRow(["Employee number", "Year", "Month", "Total working days", "Paid days", "Absent days"]);
  sheet.addRow(["E1001", 2026, 4, "20", "18", "5"]);
  sheet.addRow(["E1002", 2026, 4, "26", "26", "0"]);
  sheet.getCell("A3").value = { formula: "A2", result: "E1002" };
  const parsed = await parseAttendanceSheet(Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.equal(parsed.rows.length, 0);
  assert.equal(parsed.errors.some((issue) => issue.message.includes("cannot exceed")), true);
  assert.equal(parsed.errors.some((issue) => issue.message.includes("formula")), true);
});

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("a payslip can be drawn on a png template", async () => {
  const snapshot: PayslipSnapshot = {
    version: 1,
    company: { name: "Root Coir", address: "Kerala", currency: "INR" },
    employee: {
      fullName: "Asha",
      employeeNumber: "E1001",
      designation: "Operator",
      department: "Plant",
      dateOfJoining: "2020-01-15",
      pan: null,
      uan: null,
      esiNumber: null,
    },
    attendance: { totalWorkingDays: "26.00", paidDays: "26.00", lopDays: "0.00" },
    earnings: {
      basicSalary: "1000.00",
      hra: "0.00",
      specialAllowance: "0.00",
      otherAllowances: "0.00",
      overtime: null,
      bonus: null,
      grossEarnings: "1000.00",
    },
    deductions: {
      employeePf: null,
      employeeEsi: null,
      professionalTax: null,
      tds: null,
      salaryAdvance: null,
      otherDeductions: null,
      totalDeductions: "0.00",
    },
    netPay: "1000.00",
    amountInWords: "One Thousand Rupees Only",
    payslipNumber: "PS2026040001",
  };
  const rendered = await renderPayslipPdf(
    buildPayslipDocument(snapshot, { year: 2026, month: 4, revision: 1, status: "FINALIZED", voidReason: null }),
    png,
  );
  assert.equal(rendered.pageCount >= 1, true);
  assert.equal(rendered.bytes.subarray(0, 4).toString(), "%PDF");
});
