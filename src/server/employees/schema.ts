import { EmploymentStatus } from "@prisma/client";
import Decimal from "decimal.js";
import { z } from "zod";
import { formatIsoDate, parseIsoDate } from "@/lib/dates";
import { toMoney } from "@/lib/money";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value));

export const employeeInputSchema = z.object({
  id: z.string().uuid().optional(),
  employeeNumber: z.string().trim().min(1).max(40),
  fullName: z.string().trim().min(1).max(120),
  workEmail: z
    .string()
    .trim()
    .email()
    .max(160)
    .transform((value) => value.toLowerCase()),
  phone: optionalText(20).refine((value) => value === null || /^[0-9+\-() ]+$/.test(value), {
    message: "Enter a valid phone number.",
  }),
  designation: z.string().trim().min(1).max(80),
  department: z.string().trim().min(1).max(80),
  dateOfJoining: z.string().trim().transform((value, ctx) => {
    const parsed = parseIsoDate(value);
    if (!parsed) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid joining date." });
      return z.NEVER;
    }
    return parsed;
  }),
  status: z.nativeEnum(EmploymentStatus),
  pan: optionalText(10).transform((value, ctx) => {
    if (value === null) return null;
    const normalized = value.toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalized)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid PAN or leave it blank." });
      return z.NEVER;
    }
    return normalized;
  }),
  uan: optionalText(12).refine((value) => value === null || /^\d{12}$/.test(value), {
    message: "Enter a 12-digit UAN or leave it blank.",
  }),
  esiNumber: optionalText(20).refine((value) => value === null || /^[A-Za-z0-9]+$/.test(value), {
    message: "Enter a valid ESI number or leave it blank.",
  }),
});

export type EmployeeInput = z.infer<typeof employeeInputSchema>;

const MAX_MONEY = new Decimal("999999999999.99");

function amount(label: string) {
  return z.string().trim().transform((value, ctx) => {
    const text = value.length === 0 ? "0" : value;
    if (!/^\d+(\.\d{1,4})?$/.test(text)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Enter ${label} as a number.` });
      return z.NEVER;
    }
    const money = toMoney(text);
    if (money.gt(MAX_MONEY)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is too large.` });
      return z.NEVER;
    }
    return money;
  });
}

export const salaryInputSchema = z.object({
  id: z.string().uuid(),
  basicSalary: amount("basic salary"),
  hra: amount("HRA"),
  specialAllowance: amount("special allowance"),
  otherAllowances: amount("other allowances"),
  employeePf: amount("employee PF"),
  employeeEsi: amount("employee ESI"),
  professionalTax: amount("professional tax"),
  tds: amount("TDS"),
});

export type SalaryInput = z.infer<typeof salaryInputSchema>;

export function salaryFormData(formData: FormData) {
  return {
    id: formData.get("id"),
    basicSalary: formData.get("basicSalary") ?? "",
    hra: formData.get("hra") ?? "",
    specialAllowance: formData.get("specialAllowance") ?? "",
    otherAllowances: formData.get("otherAllowances") ?? "",
    employeePf: formData.get("employeePf") ?? "",
    employeeEsi: formData.get("employeeEsi") ?? "",
    professionalTax: formData.get("professionalTax") ?? "",
    tds: formData.get("tds") ?? "",
  };
}

export function employeeDefaults(employee: {
  id: string;
  employeeNumber: string;
  fullName: string;
  workEmail: string;
  phone: string | null;
  designation: string;
  department: string;
  dateOfJoining: Date;
  status: EmployeeInput["status"];
  pan: string | null;
  uan: string | null;
  esiNumber: string | null;
}) {
  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    fullName: employee.fullName,
    workEmail: employee.workEmail,
    phone: employee.phone ?? "",
    designation: employee.designation,
    department: employee.department,
    dateOfJoining: formatIsoDate(employee.dateOfJoining),
    status: employee.status,
    pan: employee.pan ?? "",
    uan: employee.uan ?? "",
    esiNumber: employee.esiNumber ?? "",
  };
}

export function employeeFormData(formData: FormData) {
  const id = formData.get("id");
  return {
    id: typeof id === "string" && id.length > 0 ? id : undefined,
    employeeNumber: formData.get("employeeNumber"),
    fullName: formData.get("fullName"),
    workEmail: formData.get("workEmail"),
    phone: formData.get("phone") ?? "",
    designation: formData.get("designation"),
    department: formData.get("department"),
    dateOfJoining: formData.get("dateOfJoining"),
    status: formData.get("status"),
    pan: formData.get("pan") ?? "",
    uan: formData.get("uan") ?? "",
    esiNumber: formData.get("esiNumber") ?? "",
  };
}
