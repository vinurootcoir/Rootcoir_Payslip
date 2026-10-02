"use server";

import { logFailure } from "@/lib/log";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireRole } from "@/server/auth/guard";
import { mutationGuard } from "@/server/auth/request";
import { getDb } from "@/server/db";
import { payslipAmounts } from "./salary";
import { employeeFormData, employeeInputSchema, salaryFormData, salaryInputSchema, type EmployeeInput } from "./schema";
import {
  EMPLOYEE_SHEET_BYTE_LIMIT,
  parseEmployeeSheet,
  type EmployeeSheetError,
  type EmployeeSheetPreview,
  type ParsedEmployeeRow,
} from "./sheet";

export type EmployeeFormState = { error: string | null };

const staff = ["SUPER_ADMIN", "ADMIN"] as const;

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

function duplicateMessage(error: Prisma.PrismaClientKnownRequestError): string {
  const target = Array.isArray(error.meta?.target) ? error.meta.target.join(" ") : "";
  if (target.includes("work_email")) return "That work email is already used.";
  if (target.includes("employee_number")) return "That employee number is already used.";
  return "That employee number or work email is already used.";
}

function auditFields(before: EmployeeInput | null, after: EmployeeInput): string[] {
  if (!before) return ["profile"];
  const fields: (keyof EmployeeInput)[] = [
    "employeeNumber",
    "fullName",
    "workEmail",
    "phone",
    "designation",
    "department",
    "dateOfJoining",
    "status",
    "pan",
    "uan",
    "esiNumber",
  ];
  const sensitive = new Set(["pan", "uan", "esiNumber"]);
  return fields
    .filter((field) => {
      const left = field === "dateOfJoining" ? before.dateOfJoining.toISOString() : before[field];
      const right = field === "dateOfJoining" ? after.dateOfJoining.toISOString() : after[field];
      return left !== right;
    })
    .map((field) => (sensitive.has(field) ? "sensitive_identifier" : field));
}

export async function saveEmployee(
  _state: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { error: blocked };

  const actor = await requireRole(staff);
  const parsed = employeeInputSchema.safeParse(employeeFormData(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const input = parsed.data;
  let savedId = input.id ?? "";

  try {
    const db = getDb();
    if (input.id) {
      const existing = await db.employee.findUnique({
        where: { id: input.id },
        select: {
          employeeNumber: true,
          fullName: true,
          workEmail: true,
          phone: true,
          designation: true,
          department: true,
          dateOfJoining: true,
          status: true,
          pan: true,
          uan: true,
          esiNumber: true,
        },
      });
      if (!existing) return { error: "Employee not found." };

      const before: EmployeeInput = {
        ...existing,
        dateOfJoining: existing.dateOfJoining,
        phone: existing.phone,
        pan: existing.pan,
        uan: existing.uan,
        esiNumber: existing.esiNumber,
      };
      await db.$transaction([
        db.employee.update({
          where: { id: input.id },
          data: {
            employeeNumber: input.employeeNumber,
            fullName: input.fullName,
            workEmail: input.workEmail,
            phone: input.phone,
            designation: input.designation,
            department: input.department,
            dateOfJoining: input.dateOfJoining,
            status: input.status,
            pan: input.pan,
            uan: input.uan,
            esiNumber: input.esiNumber,
            updatedById: actor.id,
          },
        }),
        db.auditLog.create({
          data: {
            actorId: actor.id,
            action: input.status !== existing.status && input.status !== "ACTIVE"
              ? "employee.deactivate"
              : "employee.update",
            targetType: "employee",
            targetId: input.id,
            requestId: crypto.randomUUID(),
            metadata: { fields: auditFields(before, input) },
          },
        }),
      ]);
    } else {
      const created = await db.$transaction(async (tx) => {
        const row = await tx.employee.create({
          data: {
            employeeNumber: input.employeeNumber,
            fullName: input.fullName,
            workEmail: input.workEmail,
            phone: input.phone,
            designation: input.designation,
            department: input.department,
            dateOfJoining: input.dateOfJoining,
            status: input.status,
            pan: input.pan,
            uan: input.uan,
            esiNumber: input.esiNumber,
            createdById: actor.id,
            updatedById: actor.id,
          },
          select: { id: true },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: "employee.create",
            targetType: "employee",
            targetId: row.id,
            requestId: crypto.randomUUID(),
            metadata: { fields: ["profile"] },
          },
        });
        return row;
      });
      savedId = created.id;
    }
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: duplicateMessage(error) };
    }
    logFailure("employee.save", error);
    return { error: "Something went wrong. Try again." };
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${savedId}`);
  redirect(`/employees/${savedId}`);
}

export type SalaryFormState = { error: string | null; saved: boolean; warning: string | null };

export async function saveEmployeeSalary(
  _state: SalaryFormState,
  formData: FormData,
): Promise<SalaryFormState> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { error: blocked, saved: false, warning: null };
  const actor = await requireRole(staff);
  const parsed = salaryInputSchema.safeParse(salaryFormData(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error), saved: false, warning: null };

  const input = parsed.data;
  const preview = payslipAmounts(input, "INR");
  const warning = preview.errors.find((error) => error.includes("negative")) ?? null;

  try {
    const db = getDb();
    const company = await db.companySettings.findUnique({ where: { id: 1 }, select: { currency: true } });
    const currency = company?.currency || "INR";
    await db.$transaction(async (tx) => {
      const updated = await tx.employee.updateMany({
        where: { id: input.id },
        data: {
          basicSalary: input.basicSalary.toFixed(2),
          hra: input.hra.toFixed(2),
          specialAllowance: input.specialAllowance.toFixed(2),
          otherAllowances: input.otherAllowances.toFixed(2),
          employeePf: input.employeePf.toFixed(2),
          employeeEsi: input.employeeEsi.toFixed(2),
          professionalTax: input.professionalTax.toFixed(2),
          tds: input.tds.toFixed(2),
          updatedById: actor.id,
        },
      });
      if (updated.count !== 1) throw new Error("MISSING");
      const drafts = await tx.payrollRecord.findMany({
        where: { employeeId: input.id, status: "DRAFT" },
        select: {
          id: true,
          totalWorkingDays: true,
          paidDays: true,
          lopDays: true,
          overtime: true,
          bonus: true,
          salaryAdvance: true,
          otherDeductions: true,
        },
      });
      for (const draft of drafts) {
        const amounts = payslipAmounts(input, currency, draft);
        await tx.payrollRecord.update({
          where: { id: draft.id, status: "DRAFT" },
          data: {
            basicSalary: amounts.basicSalary,
            hra: amounts.hra,
            specialAllowance: amounts.specialAllowance,
            otherAllowances: amounts.otherAllowances,
            employeePf: amounts.employeePf,
            employeeEsi: amounts.employeeEsi,
            professionalTax: amounts.professionalTax,
            tds: amounts.tds,
            grossEarnings: amounts.grossEarnings,
            totalDeductions: amounts.totalDeductions,
            netPay: amounts.netPay,
            amountInWords: amounts.amountInWords,
            currency,
            updatedById: actor.id,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "employee.update",
          targetType: "employee",
          targetId: input.id,
          requestId: crypto.randomUUID(),
          metadata: { fields: ["salary"] },
        },
      });
    });
  } catch (error) {
    unstable_rethrow(error);
    logFailure("employee.salary", error);
    return { error: "Something went wrong. Try again.", saved: false, warning: null };
  }

  revalidatePath(`/employees/${input.id}`);
  revalidatePath("/payroll", "layout");
  return { error: null, saved: true, warning };
}

export type EmployeeImportState = {
  error: string | null;
  errors: EmployeeSheetError[];
  preview: EmployeeSheetPreview[] | null;
};

const emptyImport: EmployeeImportState = { error: null, errors: [], preview: null };

export async function reviewEmployeeSheet(formData: FormData): Promise<EmployeeImportState> {
  const prepared = await preparedSheet(formData);
  if (!prepared.ok) return prepared.state;
  return { error: null, errors: [], preview: prepared.rows.map((row) => row.preview) };
}

export async function importEmployeeSheet(formData: FormData): Promise<EmployeeImportState> {
  const prepared = await preparedSheet(formData);
  if (!prepared.ok) return prepared.state;

  try {
    await getDb().$transaction(async (tx) => {
      await tx.employee.createMany({
        data: prepared.rows.map((row) => ({
          employeeNumber: row.input.employeeNumber,
          fullName: row.input.fullName,
          workEmail: row.input.workEmail,
          phone: row.input.phone,
          designation: row.input.designation,
          department: row.input.department,
          dateOfJoining: row.input.dateOfJoining,
          status: row.input.status,
          pan: row.input.pan,
          uan: row.input.uan,
          esiNumber: row.input.esiNumber,
          createdById: prepared.actorId,
          updatedById: prepared.actorId,
        })),
      });
      await tx.auditLog.create({
        data: {
          actorId: prepared.actorId,
          action: "employee.import",
          targetType: "employee",
          requestId: crypto.randomUUID(),
          metadata: { count: prepared.rows.length },
        },
      });
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ...emptyImport, error: duplicateMessage(error) };
    }
    logFailure("employee.import", error);
    return { ...emptyImport, error: "Something went wrong. Try again." };
  }

  revalidatePath("/employees");
  redirect(`/employees?imported=${prepared.rows.length}`);
}

async function preparedSheet(
  formData: FormData,
): Promise<{ ok: true; actorId: string; rows: ParsedEmployeeRow[] } | { ok: false; state: EmployeeImportState }> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { ok: false, state: { ...emptyImport, error: blocked } };
  const actor = await requireRole(staff);
  const file = await workbookBytes(formData);
  if ("error" in file) return { ok: false, state: { ...emptyImport, error: file.error } };

  let parsed: Awaited<ReturnType<typeof parseEmployeeSheet>>;
  try {
    parsed = await parseEmployeeSheet(file.bytes);
  } catch (error) {
    logFailure("employee.import", error);
    return { ok: false, state: { ...emptyImport, error: "That Excel file could not be read." } };
  }
  if (parsed.errors.length > 0) return { ok: false, state: { ...emptyImport, errors: parsed.errors } };

  const taken = await existingRowErrors(parsed.rows);
  if (taken.length > 0) return { ok: false, state: { ...emptyImport, errors: taken } };
  return { ok: true, actorId: actor.id, rows: parsed.rows };
}

async function workbookBytes(formData: FormData): Promise<{ bytes: Uint8Array } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an Excel file." };
  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx")) return { error: "Upload an .xlsx file. Macro-enabled workbooks are not accepted." };
  if (file.size > EMPLOYEE_SHEET_BYTE_LIMIT) return { error: "That file is too large." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return { error: "Upload an .xlsx file." };
  if (Buffer.from(bytes).includes(Buffer.from("vbaProject.bin"))) {
    return { error: "Macro-enabled workbooks are not accepted." };
  }
  return { bytes };
}

async function existingRowErrors(rows: ParsedEmployeeRow[]): Promise<EmployeeSheetError[]> {
  const existing = await getDb().employee.findMany({
    where: {
      OR: [
        { employeeNumber: { in: rows.map((row) => row.input.employeeNumber) } },
        { workEmail: { in: rows.map((row) => row.input.workEmail) } },
      ],
    },
    select: { employeeNumber: true, workEmail: true },
  });
  const numbers = new Set(existing.map((row) => row.employeeNumber));
  const emails = new Set(existing.map((row) => row.workEmail));
  const errors: EmployeeSheetError[] = [];
  for (const row of rows) {
    if (numbers.has(row.input.employeeNumber)) {
      errors.push({ row: row.row, message: "That employee number is already used." });
    } else if (emails.has(row.input.workEmail)) {
      errors.push({ row: row.row, message: "That work email is already used." });
    }
  }
  return errors;
}
