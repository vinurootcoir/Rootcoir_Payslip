"use server";

import { logFailure } from "@/lib/log";

import { AccountStatus, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { isUuid } from "@/lib/ids";
import { canChangeAccess, loginForNewUser } from "@/server/access/policy";
import { writeAudit } from "@/server/auth/audit";
import { requireRole } from "@/server/auth/guard";
import { hashPassword } from "@/server/auth/password";
import { mutationGuard } from "@/server/auth/request";
import { getDb } from "@/server/db";

const superAdmin = ["SUPER_ADMIN"] as const;

export type UserFormState = { error: string | null; saved: boolean };

const passwordSchema = z.string().min(6).max(128);

export async function createPortalUser(_state: UserFormState, formData: FormData): Promise<UserFormState> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { error: blocked, saved: false };
  const actor = await requireRole(superAdmin);
  const roleParsed = z.nativeEnum(UserRole).safeParse(formData.get("role"));
  if (!roleParsed.success) return { error: "Choose a role.", saved: false };
  const password = passwordSchema.safeParse(formData.get("password"));
  const confirm = formData.get("confirmPassword");
  if (!password.success || password.data !== confirm) {
    return { error: "Use 6 to 128 characters, and make both passwords match.", saved: false };
  }

  const employeeId = String(formData.get("employeeId") ?? "");
  let employeeEmail: string | null = null;
  let alreadyLinked = false;
  if (roleParsed.data === "USER") {
    if (!isUuid(employeeId)) return { error: "Choose an employee.", saved: false };
    const employee = await getDb().employee.findUnique({
      where: { id: employeeId },
      select: { workEmail: true, user: { select: { id: true } } },
    });
    if (!employee) return { error: "Choose an employee.", saved: false };
    employeeEmail = employee.workEmail;
    alreadyLinked = employee.user !== null;
  }

  const login = loginForNewUser({
    role: roleParsed.data,
    employeeEmail,
    employeeAlreadyLinked: alreadyLinked,
    accountEmail: String(formData.get("email") ?? ""),
  });
  if (!login.ok) return { error: login.error, saved: false };

  try {
    const passwordHash = await hashPassword(password.data);
    const created = await getDb().user.create({
      data: {
        email: login.email,
        passwordHash,
        role: roleParsed.data,
        status: "ACTIVE",
        employeeId: login.linkEmployee ? employeeId : null,
      },
      select: { id: true },
    });
    await writeAudit({
      actorId: actor.id,
      action: "user.create",
      targetType: "user",
      targetId: created.id,
      metadata: { role: roleParsed.data },
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "That email or employee already has a login.", saved: false };
    }
    logFailure("user.create", error);
    return { error: "Something went wrong. Try again.", saved: false };
  }

  revalidatePath("/settings/users");
  redirect("/settings/users");
}

export async function updateUserAccess(_state: UserFormState, formData: FormData): Promise<UserFormState> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { error: blocked, saved: false };
  const actor = await requireRole(superAdmin);
  const targetId = String(formData.get("userId") ?? "");
  if (!isUuid(targetId)) return { error: "Account not found.", saved: false };
  const nextRole = z.nativeEnum(UserRole).safeParse(formData.get("role"));
  const nextStatus = z.nativeEnum(AccountStatus).safeParse(formData.get("status"));
  if (!nextRole.success || !nextStatus.success) return { error: "Choose a role and status.", saved: false };

  try {
    const decision = await getDb().$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetId },
        select: { id: true, role: true, status: true },
      });
      if (!target) return { error: "Account not found." as const };
      const activeSuperAdmins = await tx.user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } });
      const access = canChangeAccess({
        actorId: actor.id,
        targetId: target.id,
        targetRole: target.role,
        targetStatus: target.status,
        nextRole: nextRole.data,
        nextStatus: nextStatus.data,
        activeSuperAdmins,
      });
      if (!access.ok) return { error: access.error };
      if (target.role === nextRole.data && target.status === nextStatus.data) return { saved: true as const, revoked: false };
      await tx.user.update({
        where: { id: target.id },
        data: { role: nextRole.data, status: nextStatus.data },
        select: { id: true },
      });
      if (access.revokeSessions) await tx.session.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: nextStatus.data === "INACTIVE" && target.status === "ACTIVE" ? "user.deactivate" : "user.role",
          targetType: "user",
          targetId: target.id,
          requestId: crypto.randomUUID(),
          metadata: { role: nextRole.data, status: nextStatus.data },
        },
      });
      return { saved: true as const, revoked: access.revokeSessions };
    });
    if ("error" in decision && decision.error) return { error: decision.error, saved: false };
    revalidatePath("/settings/users");
    revalidatePath(`/settings/users/${targetId}`);
    return { error: null, saved: true };
  } catch (error) {
    unstable_rethrow(error);
    logFailure("user.access", error);
    return { error: "Something went wrong. Try again.", saved: false };
  }
}
