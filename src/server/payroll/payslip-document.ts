import { formatDisplayDate, formatPayrollMonth, parseIsoDate } from "@/lib/dates";
import { formatMoney, sumMoney, toDays, toMoney } from "@/lib/money";
import type { PayslipSnapshot } from "./snapshot";

export type PayslipPdfMeta = {
  year: number;
  month: number;
  revision: number;
  status: "FINALIZED" | "VOID";
  voidReason: string | null;
};

export type PayslipRow = { label: string; value: string };

export type PayslipBlock =
  | { kind: "paragraphs"; title: string; paragraphs: string[] }
  | { kind: "rows"; title: string; rows: PayslipRow[] };

export type SalarySlipFields = {
  salaryMonth: string;
  employeeName: string;
  employeeNumber: string;
  designation: string;
  department: string;
  payPeriod: string;
  paidDays: string;
  lopDays: string;
  paymentStatus: string;
  basic: string;
  hra: string;
  conveyance: string;
  special: string;
  gross: string;
  epf: string;
  esi: string;
  professionalTax: string;
  otherDeductions: string;
  totalDeductions: string;
  net: string;
  amountInWords: string;
  voidNote: string | null;
};

export type PayslipDocument = {
  filename: string;
  companyName: string;
  companyAddress: string[];
  payslipNumber: string;
  employeeName: string;
  notice: string | null;
  blocks: PayslipBlock[];
  disclaimer: string;
  slip: SalarySlipFields;
};

function inr(value: Parameters<typeof toMoney>[0]): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(toMoney(value).toFixed(2)));
}

function dayLabel(value: string): string {
  try {
    const parsed = toDays(value);
    return parsed.isInteger() ? parsed.toFixed(0) : parsed.toFixed(2);
  } catch {
    return value;
  }
}

function text(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function money(value: string, currency: string): string {
  try {
    return formatMoney(value, currency);
  } catch {
    return `${currency} ${value}`;
  }
}

function days(value: string): string {
  try {
    const parsed = toDays(value);
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(parsed.toFixed(2)));
  } catch {
    return value;
  }
}

function row(label: string, value: string | null): PayslipRow | null {
  if (!value) return null;
  return { label, value };
}

function rows(entries: Array<PayslipRow | null>): PayslipRow[] {
  return entries.filter((entry): entry is PayslipRow => entry !== null);
}

export function salarySlipFields(input: {
  year: number;
  month: number;
  status: "DRAFT" | "FINALIZED" | "VOID";
  voidReason: string | null;
  employeeName: string;
  employeeNumber: string;
  designation: string;
  department: string;
  paidDays: string;
  lopDays: string;
  basic: string;
  hra: string;
  specialAllowance: string;
  otherAllowances: string;
  overtime: string | null;
  bonus: string | null;
  gross: string;
  employeePf: string | null;
  employeeEsi: string | null;
  professionalTax: string | null;
  tds: string | null;
  salaryAdvance: string | null;
  otherDeductions: string | null;
  totalDeductions: string;
  net: string;
  amountInWords: string | null;
}): SalarySlipFields {
  const reason = text(input.voidReason);
  const monthLabel = formatPayrollMonth(input.year, input.month);
  return {
    salaryMonth: monthLabel,
    employeeName: text(input.employeeName) ?? "",
    employeeNumber: text(input.employeeNumber) ?? "",
    designation: text(input.designation) ?? "",
    department: text(input.department) ?? "",
    payPeriod: monthLabel,
    paidDays: dayLabel(input.paidDays),
    lopDays: dayLabel(input.lopDays),
    paymentStatus: input.status === "VOID" ? "Void" : input.status === "DRAFT" ? "Draft" : "Finalized",
    basic: inr(input.basic),
    hra: inr(input.hra),
    conveyance: inr(input.otherAllowances),
    special: inr(sumMoney([input.specialAllowance, input.overtime ?? 0, input.bonus ?? 0])),
    gross: inr(input.gross),
    epf: inr(input.employeePf ?? 0),
    esi: inr(input.employeeEsi ?? 0),
    professionalTax: inr(input.professionalTax ?? 0),
    otherDeductions: inr(sumMoney([input.tds ?? 0, input.salaryAdvance ?? 0, input.otherDeductions ?? 0])),
    totalDeductions: inr(input.totalDeductions),
    net: inr(input.net),
    amountInWords: text(input.amountInWords) ?? "",
    voidNote: input.status === "VOID" ? reason ?? "This payslip was voided." : null,
  };
}

export function pdfFilename(payslipNumber: string): string {
  const safe = payslipNumber.replace(/[^A-Za-z0-9_-]/g, "");
  return `${safe || "payslip"}.pdf`;
}

export function buildPayslipDocument(snapshot: PayslipSnapshot, meta: PayslipPdfMeta): PayslipDocument {
  const currency = text(snapshot.company.currency) ?? "INR";
  const companyName = text(snapshot.company.name) ?? "";
  const employeeName = text(snapshot.employee.fullName) ?? "";
  const joined = text(snapshot.employee.dateOfJoining);
  const joinedDate = joined ? parseIsoDate(joined) : null;
  const statutory = rows([
    row("PAN", text(snapshot.employee.pan)),
    row("UAN", text(snapshot.employee.uan)),
    row("ESI number", text(snapshot.employee.esiNumber)),
  ]);
  const blocks: PayslipBlock[] = [
    {
      kind: "rows",
      title: "Payslip details",
      rows: rows([
        row("Payroll month", formatPayrollMonth(meta.year, meta.month)),
        row("Payslip number", text(snapshot.payslipNumber)),
        row("Revision", String(meta.revision)),
        row("Status", meta.status === "VOID" ? "Void" : "Finalized"),
      ]),
    },
    {
      kind: "rows",
      title: "Employee details",
      rows: rows([
        row("Name", employeeName),
        row("Employee number", text(snapshot.employee.employeeNumber)),
        row("Designation", text(snapshot.employee.designation)),
        row("Department", text(snapshot.employee.department)),
        row("Date of joining", joinedDate ? formatDisplayDate(joinedDate) : joined),
      ]),
    },
    {
      kind: "rows",
      title: "Attendance",
      rows: [
        { label: "Total working days", value: days(snapshot.attendance.totalWorkingDays) },
        { label: "Paid days", value: days(snapshot.attendance.paidDays) },
        { label: "Absent / LOP days", value: days(snapshot.attendance.lopDays) },
        ...(snapshot.attendance.casualLeaveDays
          ? [{ label: "Casual leave", value: days(snapshot.attendance.casualLeaveDays) }]
          : []),
        ...(snapshot.attendance.sickLeaveDays
          ? [{ label: "Sick leave", value: days(snapshot.attendance.sickLeaveDays) }]
          : []),
      ],
    },
    {
      kind: "rows",
      title: "Earnings",
      rows: rows([
        row("Basic salary", money(snapshot.earnings.basicSalary, currency)),
        row("HRA", money(snapshot.earnings.hra, currency)),
        row("Special allowance", money(snapshot.earnings.specialAllowance, currency)),
        row("Other allowances", money(snapshot.earnings.otherAllowances, currency)),
        row("Overtime", snapshot.earnings.overtime ? money(snapshot.earnings.overtime, currency) : null),
        row("Bonus / incentive", snapshot.earnings.bonus ? money(snapshot.earnings.bonus, currency) : null),
        row("Gross earnings", money(snapshot.earnings.grossEarnings, currency)),
      ]),
    },
    {
      kind: "rows",
      title: "Deductions",
      rows: rows([
        row("Employee PF", snapshot.deductions.employeePf ? money(snapshot.deductions.employeePf, currency) : null),
        row("Employee ESI", snapshot.deductions.employeeEsi ? money(snapshot.deductions.employeeEsi, currency) : null),
        row("Professional tax", snapshot.deductions.professionalTax ? money(snapshot.deductions.professionalTax, currency) : null),
        row("TDS", snapshot.deductions.tds ? money(snapshot.deductions.tds, currency) : null),
        row("Salary advance / loan", snapshot.deductions.salaryAdvance ? money(snapshot.deductions.salaryAdvance, currency) : null),
        row("Other deductions", snapshot.deductions.otherDeductions ? money(snapshot.deductions.otherDeductions, currency) : null),
        row("Total deductions", money(snapshot.deductions.totalDeductions, currency)),
      ]),
    },
    {
      kind: "rows",
      title: "Final salary",
      rows: rows([
        row("Gross earnings", money(snapshot.earnings.grossEarnings, currency)),
        row("Total deductions", money(snapshot.deductions.totalDeductions, currency)),
        row("Net pay", money(snapshot.netPay, currency)),
        row("Amount in words", text(snapshot.amountInWords)),
      ]),
    },
  ];
  if (statutory.length > 0) {
    blocks.push({ kind: "rows", title: "Statutory / identification", rows: statutory });
  }

  const reason = text(meta.voidReason);
  const slip = salarySlipFields({
    year: meta.year,
    month: meta.month,
    status: meta.status,
    voidReason: meta.voidReason,
    employeeName,
    employeeNumber: snapshot.employee.employeeNumber,
    designation: snapshot.employee.designation,
    department: snapshot.employee.department,
    paidDays: snapshot.attendance.paidDays,
    lopDays: snapshot.attendance.lopDays,
    basic: snapshot.earnings.basicSalary,
    hra: snapshot.earnings.hra,
    specialAllowance: snapshot.earnings.specialAllowance,
    otherAllowances: snapshot.earnings.otherAllowances,
    overtime: snapshot.earnings.overtime,
    bonus: snapshot.earnings.bonus,
    gross: snapshot.earnings.grossEarnings,
    employeePf: snapshot.deductions.employeePf,
    employeeEsi: snapshot.deductions.employeeEsi,
    professionalTax: snapshot.deductions.professionalTax,
    tds: snapshot.deductions.tds,
    salaryAdvance: snapshot.deductions.salaryAdvance,
    otherDeductions: snapshot.deductions.otherDeductions,
    totalDeductions: snapshot.deductions.totalDeductions,
    net: snapshot.netPay,
    amountInWords: snapshot.amountInWords,
  });
  return {
    filename: pdfFilename(snapshot.payslipNumber),
    companyName,
    companyAddress: snapshot.company.address
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
    payslipNumber: text(snapshot.payslipNumber) ?? "",
    employeeName,
    notice: meta.status === "VOID" ? (reason ? `This payslip was voided. ${reason}` : "This payslip was voided.") : null,
    blocks,
    disclaimer:
      "Figures are the amounts recorded when this payslip was finalized. Statutory contributions are not calculated by this document.",
    slip,
  };
}
