import { Prisma } from "@prisma/client";
import { calculatePayroll, type PayrollInput } from "./calculate";

export type PayslipSnapshot = {
  version: 1;
  company: { name: string; address: string; currency: string };
  employee: {
    fullName: string;
    employeeNumber: string;
    designation: string;
    department: string;
    dateOfJoining: string;
    pan: string | null;
    uan: string | null;
    esiNumber: string | null;
  };
  attendance: { totalWorkingDays: string; paidDays: string; lopDays: string };
  earnings: {
    basicSalary: string;
    hra: string;
    specialAllowance: string;
    otherAllowances: string;
    overtime: string | null;
    bonus: string | null;
    grossEarnings: string;
  };
  deductions: {
    employeePf: string | null;
    employeeEsi: string | null;
    professionalTax: string | null;
    tds: string | null;
    salaryAdvance: string | null;
    otherDeductions: string | null;
    totalDeductions: string;
  };
  netPay: string;
  amountInWords: string;
  payslipNumber: string;
};

function money(value: { toFixed: (digits: number) => string } | null): string | null {
  return value ? value.toFixed(2) : null;
}

export function buildSnapshot(input: {
  company: { name: string; address: string; currency: string };
  employee: {
    fullName: string;
    employeeNumber: string;
    designation: string;
    department: string;
    dateOfJoining: Date;
    pan: string | null;
    uan: string | null;
    esiNumber: string | null;
  };
  components: PayrollInput;
  payslipNumber: string;
}): PayslipSnapshot {
  const totals = calculatePayroll(input.components, input.company.currency);
  const components = input.components;
  return {
    version: 1,
    company: {
      name: input.company.name,
      address: input.company.address,
      currency: input.company.currency,
    },
    employee: {
      fullName: input.employee.fullName,
      employeeNumber: input.employee.employeeNumber,
      designation: input.employee.designation,
      department: input.employee.department,
      dateOfJoining: input.employee.dateOfJoining.toISOString().slice(0, 10),
      pan: input.employee.pan,
      uan: input.employee.uan,
      esiNumber: input.employee.esiNumber,
    },
    attendance: {
      totalWorkingDays: components.totalWorkingDays.toFixed(2),
      paidDays: components.paidDays.toFixed(2),
      lopDays: components.lopDays.toFixed(2),
    },
    earnings: {
      basicSalary: components.basicSalary.toFixed(2),
      hra: components.hra.toFixed(2),
      specialAllowance: components.specialAllowance.toFixed(2),
      otherAllowances: components.otherAllowances.toFixed(2),
      overtime: money(components.overtime),
      bonus: money(components.bonus),
      grossEarnings: totals.grossEarnings.toFixed(2),
    },
    deductions: {
      employeePf: money(components.employeePf),
      employeeEsi: money(components.employeeEsi),
      professionalTax: money(components.professionalTax),
      tds: money(components.tds),
      salaryAdvance: money(components.salaryAdvance),
      otherDeductions: money(components.otherDeductions),
      totalDeductions: totals.totalDeductions.toFixed(2),
    },
    netPay: totals.netPay.toFixed(2),
    amountInWords: totals.amountInWords,
    payslipNumber: input.payslipNumber,
  };
}

export function snapshotJson(snapshot: PayslipSnapshot): Prisma.InputJsonValue {
  return snapshot;
}

export function readSnapshot(value: Prisma.JsonValue | null): PayslipSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!("version" in value) || value.version !== 1) return null;
  return value as PayslipSnapshot;
}
