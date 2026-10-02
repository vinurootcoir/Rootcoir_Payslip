import { z } from "zod";
import type { AccountStatus, UserRole } from "@prisma/client";

const emailSchema = z.string().trim().email().max(160);

export function employeeCanSeePayslip(
  actorEmployeeId: string | null,
  record: { employeeId: string; status: "DRAFT" | "FINALIZED" | "VOID" },
): boolean {
  if (!actorEmployeeId || actorEmployeeId !== record.employeeId) return false;
  return record.status === "FINALIZED" || record.status === "VOID";
}

export function loginForNewUser(input: {
  role: UserRole;
  employeeEmail: string | null;
  employeeAlreadyLinked: boolean;
  accountEmail: string;
}): { ok: true; email: string; linkEmployee: boolean } | { ok: false; error: string } {
  if (input.role === "USER") {
    if (!input.employeeEmail) return { ok: false, error: "Choose an employee." };
    if (input.employeeAlreadyLinked) return { ok: false, error: "That employee already has a portal login." };
    const parsed = emailSchema.safeParse(input.employeeEmail);
    if (!parsed.success) return { ok: false, error: "That employee does not have a valid work email." };
    return { ok: true, email: parsed.data.toLowerCase(), linkEmployee: true };
  }

  const parsed = emailSchema.safeParse(input.accountEmail);
  if (!parsed.success) return { ok: false, error: "Enter a valid email." };
  return { ok: true, email: parsed.data.toLowerCase(), linkEmployee: false };
}

export function canChangeAccess(input: {
  actorId: string;
  targetId: string;
  targetRole: UserRole;
  targetStatus: AccountStatus;
  nextRole: UserRole;
  nextStatus: AccountStatus;
  activeSuperAdmins: number;
}): { ok: true; revokeSessions: boolean } | { ok: false; error: string } {
  if (input.actorId === input.targetId) return { ok: false, error: "You cannot change your own access." };
  if (input.targetRole === "USER" && input.nextRole !== "USER") {
    return { ok: false, error: "Employee logins stay employee logins." };
  }
  if (input.targetRole !== "USER" && input.nextRole === "USER") {
    return { ok: false, error: "Create a separate employee login instead." };
  }
  const removesLastSuper =
    input.targetRole === "SUPER_ADMIN" &&
    input.targetStatus === "ACTIVE" &&
    input.activeSuperAdmins <= 1 &&
    (input.nextRole !== "SUPER_ADMIN" || input.nextStatus !== "ACTIVE");
  if (removesLastSuper) return { ok: false, error: "Keep at least one active Super Admin." };
  const revokeSessions = input.targetRole !== input.nextRole || (input.targetStatus === "ACTIVE" && input.nextStatus === "INACTIVE");
  return { ok: true, revokeSessions };
}

export function auditSummary(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const record = metadata as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof record.status === "string" && record.status.length > 0 && record.status.length <= 40) parts.push(record.status);
  if (typeof record.count === "number" && Number.isFinite(record.count)) parts.push(String(record.count));
  if (Array.isArray(record.fields) && record.fields.every((field) => typeof field === "string")) {
    parts.push(record.fields.join(", "));
  }
  if (record.revision === true) parts.push("revision");
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function parsePayslipYear(value: string | undefined): number | null {
  if (!value || value === "all") return null;
  if (!/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  if (year < 2000 || year > 2100) return null;
  return year;
}
