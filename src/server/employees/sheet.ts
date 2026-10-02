import ExcelJS from "exceljs";
import type { CellValue } from "exceljs";
import { employeeInputSchema, type EmployeeInput } from "./schema";

export const EMPLOYEE_SHEET_ROW_LIMIT = 300;
export const EMPLOYEE_SHEET_BYTE_LIMIT = 1_000_000;

const columns = [
  ["Employee number", "employeeNumber", true],
  ["Full name", "fullName", true],
  ["Work email", "workEmail", true],
  ["Phone", "phone", false],
  ["Designation", "designation", true],
  ["Department", "department", true],
  ["Date of joining", "dateOfJoining", true],
  ["Employment status", "status", false],
  ["PAN", "pan", false],
  ["UAN", "uan", false],
  ["ESI number", "esiNumber", false],
] as const;

type Field = (typeof columns)[number][1];

const headerFields = new Map<string, Field>(columns.map(([label, field]) => [normalizeHeader(label), field]));
const requiredFields = columns.filter((column) => column[2]).map((column) => column[1]);

export type EmployeeSheetError = { row: number; message: string };

export type EmployeeSheetPreview = {
  row: number;
  employeeNumber: string;
  fullName: string;
  workEmail: string;
  department: string;
  designation: string;
  dateOfJoining: string;
  status: EmployeeInput["status"];
};

export type ParsedEmployeeRow = {
  row: number;
  input: EmployeeInput;
  preview: EmployeeSheetPreview;
};

export type ParsedEmployeeSheet = {
  rows: ParsedEmployeeRow[];
  errors: EmployeeSheetError[];
};

export async function buildEmployeeSampleWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Employees");
  sheet.addRow(columns.map(([label]) => label));
  sheet.getRow(1).font = { bold: true };
  sheet.addRow([
    "E1001",
    "Asha Nair",
    "asha@example.com",
    "9876543210",
    "Operator",
    "Plant",
    "2024-04-01",
    "ACTIVE",
    "",
    "",
    "",
  ]);
  sheet.columns.forEach((column) => {
    column.width = 22;
  });

  const notes = workbook.addWorksheet("Instructions");
  notes.getColumn(1).width = 88;
  [
    "Replace the example row on the Employees sheet, or delete it before you upload.",
    "Required columns: Employee number, Full name, Work email, Designation, Department, and Date of joining.",
    "Date of joining must be YYYY-MM-DD, for example 2024-04-01.",
    "Employment status is ACTIVE, INACTIVE, or SEPARATED. A blank status is treated as ACTIVE.",
    "Phone, PAN, UAN, and ESI number are optional.",
    "Do not use formulas or macro-enabled workbooks. Type the values in the cells.",
    "This upload creates employee records. It does not create portal logins.",
  ].forEach((line) => notes.addRow([line]));

  const bytes = await workbook.xlsx.writeBuffer();
  return Buffer.from(bytes);
}

export async function parseEmployeeSheet(bytes: Uint8Array): Promise<ParsedEmployeeSheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<ExcelJS.Xlsx["load"]>[0]);
  const sheet = workbook.getWorksheet("Employees") ?? workbook.worksheets[0];
  if (!sheet) return { rows: [], errors: [{ row: 1, message: "The workbook has no worksheet." }] };

  const header = headerColumns(sheet);
  if ("error" in header) return { rows: [], errors: [{ row: 1, message: header.error }] };

  const rows: ParsedEmployeeRow[] = [];
  const errors: EmployeeSheetError[] = [];
  const numbers = new Map<string, number>();
  const emails = new Map<string, number>();
  let dataRows = 0;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1 || errors.length >= 50) return;
    const values = readRow(row, header.columns);
    if ("empty" in values) return;
    dataRows += 1;
    if (dataRows > EMPLOYEE_SHEET_ROW_LIMIT) return;
    if ("error" in values) {
      errors.push({ row: rowNumber, message: values.error });
      return;
    }

    const parsed = employeeInputSchema.safeParse(values.fields);
    if (!parsed.success) {
      errors.push({ row: rowNumber, message: parsed.error.issues[0]?.message ?? "Check this row." });
      return;
    }

    const numberKey = parsed.data.employeeNumber.toLowerCase();
    const previousNumber = numbers.get(numberKey);
    if (previousNumber) {
      errors.push({ row: rowNumber, message: `Employee number repeats row ${previousNumber}.` });
      return;
    }
    const previousEmail = emails.get(parsed.data.workEmail);
    if (previousEmail) {
      errors.push({ row: rowNumber, message: `Work email repeats row ${previousEmail}.` });
      return;
    }
    numbers.set(numberKey, rowNumber);
    emails.set(parsed.data.workEmail, rowNumber);

    const preview: EmployeeSheetPreview = {
      row: rowNumber,
      employeeNumber: parsed.data.employeeNumber,
      fullName: parsed.data.fullName,
      workEmail: parsed.data.workEmail,
      department: parsed.data.department,
      designation: parsed.data.designation,
      dateOfJoining: parsed.data.dateOfJoining.toISOString().slice(0, 10),
      status: parsed.data.status,
    };
    rows.push({ row: rowNumber, input: parsed.data, preview });
  });

  if (dataRows > EMPLOYEE_SHEET_ROW_LIMIT) {
    return {
      rows: [],
      errors: [{ row: 1, message: `Upload at most ${EMPLOYEE_SHEET_ROW_LIMIT} employees at a time.` }],
    };
  }
  if (dataRows === 0 && errors.length === 0) {
    return { rows: [], errors: [{ row: 2, message: "Add at least one employee below the header row." }] };
  }
  if (errors.length > 0) return { rows: [], errors };
  return { rows, errors: [] };
}

function headerColumns(sheet: ExcelJS.Worksheet): { columns: Map<Field, number> } | { error: string } {
  const columnsByField = new Map<Field, number>();
  const header = sheet.getRow(1);
  let formula = false;
  header.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    const text = plainCell(cell.value);
    if (!text.ok) {
      formula = text.reason === "formula";
      return;
    }
    const field = headerFields.get(normalizeHeader(text.text));
    if (field) columnsByField.set(field, columnNumber);
  });
  if (formula) return { error: "The header row contains a formula. Type the column names." };
  const missing = requiredFields.filter((field) => !columnsByField.has(field));
  if (missing.length > 0) {
    const labels = missing.map((field) => columns.find((column) => column[1] === field)?.[0]);
    return { error: `Missing columns: ${labels.join(", ")}.` };
  }
  return { columns: columnsByField };
}

function readRow(
  row: ExcelJS.Row,
  columnsByField: Map<Field, number>,
): { fields: Record<Field, string> } | { empty: true } | { error: string } {
  const fields = Object.fromEntries(columns.map((column) => [column[1], ""])) as Record<Field, string>;
  let anyValue = false;
  for (const [field, columnNumber] of columnsByField) {
    const text = plainCell(row.getCell(columnNumber).value);
    if (!text.ok) {
      return {
        error: text.reason === "formula" ? "This cell contains a formula. Type the value instead." : "This cell could not be read. Type the value instead.",
      };
    }
    if (text.text !== "") anyValue = true;
    fields[field] = text.text;
  }
  if (!anyValue) return { empty: true };
  if (fields.status.trim() === "") fields.status = "ACTIVE";
  else fields.status = fields.status.trim().toUpperCase().replace(/\s+/g, "_");
  return { fields };
}

function plainCell(value: CellValue): { ok: true; text: string } | { ok: false; reason: "formula" | "unsupported" } {
  if (value == null || value === "") return { ok: true, text: "" };
  if (value instanceof Date) return { ok: true, text: formatUtcDate(value) };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { ok: false, reason: "unsupported" };
    return { ok: true, text: Number.isInteger(value) ? String(value) : String(value) };
  }
  if (typeof value === "string") return { ok: true, text: value.trim() };
  if (typeof value === "boolean") return { ok: false, reason: "unsupported" };
  if ("formula" in value || "sharedFormula" in value) return { ok: false, reason: "formula" };
  if ("richText" in value) return { ok: true, text: value.richText.map((part) => part.text).join("").trim() };
  if ("text" in value && typeof value.text === "string" && "hyperlink" in value) return { ok: true, text: value.text.trim() };
  return { ok: false, reason: "unsupported" };
}

function formatUtcDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
