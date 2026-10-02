import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildEmployeeSampleWorkbook, parseEmployeeSheet } from "../src/server/employees/sheet";

test("the sample workbook imports the example employee and ignores the instructions sheet", async () => {
  const parsed = await parseEmployeeSheet(await buildEmployeeSampleWorkbook());
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]?.input.employeeNumber, "E1001");
  assert.equal(parsed.rows[0]?.input.workEmail, "asha@example.com");
  assert.equal(parsed.rows[0]?.input.status, "ACTIVE");
  assert.equal(parsed.rows[0]?.preview.dateOfJoining, "2024-04-01");
  assert.equal("pan" in parsed.rows[0]!.preview, false);
});

test("a blank employment status becomes active and a formula is rejected", async () => {
  const blank = new ExcelJS.Workbook();
  const blankSheet = blank.addWorksheet("Employees");
  blankSheet.addRow(["Employee number", "Full name", "Work email", "Designation", "Department", "Date of joining", "Employment status"]);
  blankSheet.addRow(["E2001", "Ravi Menon", "ravi@example.com", "Supervisor", "Plant", "2023-06-15", ""]);
  const blankParsed = await parseEmployeeSheet(Buffer.from(await blank.xlsx.writeBuffer()));
  assert.equal(blankParsed.errors.length, 0);
  assert.equal(blankParsed.rows[0]?.input.status, "ACTIVE");

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Employees");
  sheet.addRow(["Employee number", "Full name", "Work email", "Designation", "Department", "Date of joining", "Employment status"]);
  sheet.addRow(["E2001", "Ravi Menon", "ravi@example.com", "Supervisor", "Plant", "2023-06-15", ""]);
  sheet.addRow(["E2002", "Formula", "formula@example.com", "Supervisor", "Plant", "2023-06-15", "ACTIVE"]);
  sheet.getCell("A3").value = { formula: "A2", result: "E2002" };
  const parsed = await parseEmployeeSheet(Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.equal(parsed.rows.length, 0);
  assert.equal(parsed.errors.some((issue) => issue.row === 3 && issue.message.includes("formula")), true);
});

test("valid rows are kept only when every row is valid", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Employees");
  sheet.addRow(["Employee number", "Full name", "Work email", "Designation", "Department", "Date of joining"]);
  sheet.addRow(["E3001", "Meera Iyer", "meera@example.com", "Clerk", "Office", new Date(Date.UTC(2022, 0, 10))]);
  sheet.addRow(["E3001", "Second", "second@example.com", "Clerk", "Office", "2022-02-01"]);
  const notes = workbook.addWorksheet("Notes");
  notes.addRow(["This sheet is not imported"]);
  const parsed = await parseEmployeeSheet(Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.equal(parsed.rows.length, 0);
  assert.equal(parsed.errors.some((issue) => issue.message.includes("repeats row")), true);
});

test("an invalid PAN is reported and not returned as a created row", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Employees");
  sheet.addRow(["Employee number", "Full name", "Work email", "Designation", "Department", "Date of joining", "PAN"]);
  sheet.addRow(["E4001", "Dev Patel", "dev@example.com", "Clerk", "Office", "2021-01-01", "NOT-A-PAN"]);
  const parsed = await parseEmployeeSheet(Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.equal(parsed.rows.length, 0);
  assert.equal(parsed.errors[0]?.message.includes("PAN"), true);
  assert.equal(JSON.stringify(parsed).includes("NOT-A-PAN"), false);
});
