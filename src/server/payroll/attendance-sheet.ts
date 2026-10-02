import ExcelJS from "exceljs";
import type { CellValue } from "exceljs";
import { attendanceDaysSchema } from "./schema";

export const ATTENDANCE_ROW_LIMIT = 300;
export const ATTENDANCE_BYTE_LIMIT = 1_000_000;

const headers = ["Employee number", "Year", "Month", "Total working days", "Paid days", "Absent days"] as const;

export type AttendanceSheetError = { row: number; message: string };

export type AttendanceSheetRow = {
  row: number;
  employeeNumber: string;
  year: number;
  month: number;
  totalWorkingDays: string;
  paidDays: string;
  lopDays: string;
};

export async function buildAttendanceSampleWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendance");
  sheet.addRow([...headers]);
  sheet.getRow(1).font = { bold: true };
  sheet.addRow(["E1001", 2026, 4, "26", "24", "2"]);
  sheet.columns.forEach((column) => {
    column.width = 24;
  });
  const notes = workbook.addWorksheet("Instructions");
  notes.getColumn(1).width = 96;
  [
    "Replace the example row. The employee must already be on a draft payroll for that month.",
    "Year is four digits. Month is 1 to 12.",
    "Total working days, paid days, and absent days cannot be more than 31.",
    "Paid days plus absent days cannot exceed total working days.",
    "Do not use formulas or macro-enabled workbooks.",
    "Finalized months are left unchanged.",
  ].forEach((line) => notes.addRow([line]));
  const bytes = await workbook.xlsx.writeBuffer();
  return Buffer.from(bytes);
}

export async function parseAttendanceSheet(bytes: Uint8Array): Promise<{ rows: AttendanceSheetRow[]; errors: AttendanceSheetError[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<ExcelJS.Xlsx["load"]>[0]);
  const sheet = workbook.getWorksheet("Attendance") ?? workbook.worksheets[0];
  if (!sheet) return { rows: [], errors: [{ row: 1, message: "The workbook has no worksheet." }] };

  const header = sheet.getRow(1);
  const expected = headers.map((label) => label.toLowerCase());
  const actual: string[] = [];
  header.eachCell({ includeEmpty: false }, (cell) => {
    const text = plainCell(cell.value);
    if (text.ok) actual.push(text.text.trim().toLowerCase());
  });
  if (expected.some((label, index) => actual[index] !== label)) {
    return { rows: [], errors: [{ row: 1, message: `Use these columns: ${headers.join(", ")}.` }] };
  }

  const rows: AttendanceSheetRow[] = [];
  const errors: AttendanceSheetError[] = [];
  const seen = new Map<string, number>();
  let dataRows = 0;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1 || errors.length >= 50) return;
    const values = [1, 2, 3, 4, 5, 6].map((column) => plainCell(row.getCell(column).value));
    if (values.every((value) => value.ok && value.text === "")) return;
    dataRows += 1;
    if (dataRows > ATTENDANCE_ROW_LIMIT) return;
    const rejected = values.find((value) => !value.ok);
    if (rejected && !rejected.ok) {
      errors.push({
        row: rowNumber,
        message: rejected.reason === "formula" ? "This cell contains a formula. Type the value instead." : "This cell could not be read.",
      });
      return;
    }
    const [employeeNumber, yearText, monthText, totalWorkingDays, paidDays, lopDays] = values.map((value) => (value.ok ? value.text : ""));
    const year = Number(yearText);
    const month = Number(monthText);
    if (!employeeNumber) {
      errors.push({ row: rowNumber, message: "Enter an employee number." });
      return;
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
      errors.push({ row: rowNumber, message: "Enter a valid year and month." });
      return;
    }
    const parsed = attendanceDaysSchema.safeParse({ totalWorkingDays, paidDays, lopDays });
    if (!parsed.success) {
      errors.push({ row: rowNumber, message: parsed.error.issues[0]?.message ?? "Check the day counts." });
      return;
    }
    const key = `${employeeNumber.toLowerCase()}:${year}:${month}`;
    const previous = seen.get(key);
    if (previous) {
      errors.push({ row: rowNumber, message: `This employee and month repeat row ${previous}.` });
      return;
    }
    seen.set(key, rowNumber);
    rows.push({
      row: rowNumber,
      employeeNumber,
      year,
      month,
      totalWorkingDays: parsed.data.totalWorkingDays.toFixed(2),
      paidDays: parsed.data.paidDays.toFixed(2),
      lopDays: parsed.data.lopDays.toFixed(2),
    });
  });

  if (dataRows > ATTENDANCE_ROW_LIMIT) {
    return { rows: [], errors: [{ row: 1, message: `Upload at most ${ATTENDANCE_ROW_LIMIT} rows at a time.` }] };
  }
  if (dataRows === 0 && errors.length === 0) {
    return { rows: [], errors: [{ row: 2, message: "Add at least one attendance row." }] };
  }
  if (errors.length > 0) return { rows: [], errors };
  return { rows, errors: [] };
}

function plainCell(value: CellValue): { ok: true; text: string } | { ok: false; reason: "formula" | "unsupported" } {
  if (value == null || value === "") return { ok: true, text: "" };
  if (value instanceof Date) return { ok: false, reason: "unsupported" };
  if (typeof value === "number" && Number.isFinite(value)) return { ok: true, text: String(value) };
  if (typeof value === "string") return { ok: true, text: value.trim() };
  if (typeof value === "object" && ("formula" in value || "sharedFormula" in value)) return { ok: false, reason: "formula" };
  return { ok: false, reason: "unsupported" };
}
