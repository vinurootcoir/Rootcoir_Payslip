"use server";

import { logFailure } from "@/lib/log";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireRole } from "@/server/auth/guard";
import { mutationGuard } from "@/server/auth/request";
import { getDb } from "@/server/db";
import { employeeFormData, employeeInputSchema, type EmployeeInput } from "./schema";

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
