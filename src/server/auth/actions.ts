"use server";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/server/db";
import { writeAudit } from "./audit";
import { clientAddress, csrfIsValid, requestIsSameOrigin } from "./request";
import { dummyPasswordHash, hashPassword, verifyPassword } from "./password";
import {
  isLoginRateLimited,
  isPasswordChangeRateLimited,
  recordLoginAttempt,
  recordPasswordChangeAttempt,
} from "./rate-limit";
import { clearSessionCookie, createSession, getCurrentUser, revokeSession } from "./session";

export type FormState = { error: string | null };

const expiredForm = "The form expired. Refresh the page and try again.";
const genericLogin = "Invalid email or password.";
const genericFailure = "Something went wrong. Try again.";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(12).max(128),
    confirmPassword: z.string().min(12).max(128),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
  });

async function guardedForm(formData: FormData): Promise<string | null> {
  if (!(await requestIsSameOrigin()) || !(await csrfIsValid(formData.get("csrf")))) {
    return expiredForm;
  }
  return null;
}

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  const blocked = await guardedForm(formData);
  if (blocked) return { error: blocked };

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const headerList = await headers();
  const ip = clientAddress(headerList);

  try {
    if (await isLoginRateLimited(parsed.data.email, ip)) {
      return { error: "Too many attempts. Try again later." };
    }
    await recordLoginAttempt(parsed.data.email, ip);

    const user = await getDb().user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, passwordHash: true, status: true },
    });
    const passwordOk = await verifyPassword(
      user?.passwordHash ?? (await dummyPasswordHash()),
      parsed.data.password,
    );
    const active = user?.status === "ACTIVE";

    if (!user || !passwordOk || !active) {
      await writeAudit({
        actorId: user && passwordOk ? user.id : null,
        action: "auth.login.failure",
        targetType: "user",
        targetId: user && passwordOk ? user.id : null,
        metadata: { reason: user && passwordOk && !active ? "inactive" : "invalid_credentials" },
      });
      return { error: genericLogin };
    }

    await getDb().user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: { id: true },
    });
    await writeAudit({
      actorId: user.id,
      action: "auth.login.success",
      targetType: "user",
      targetId: user.id,
    });
    await createSession(user.id);
  } catch (error) {
    unstable_rethrow(error);
    console.error("auth.login", error instanceof Error ? error.name : "error");
    return { error: genericFailure };
  }

  redirect("/");
}

export async function logout(formData: FormData): Promise<void> {
  if (!(await requestIsSameOrigin()) || !(await csrfIsValid(formData.get("csrf")))) {
    return;
  }

  const current = await getCurrentUser();
  if (current) {
    await revokeSession(current.sessionId);
    await writeAudit({
      actorId: current.id,
      action: "auth.logout",
      targetType: "user",
      targetId: current.id,
    });
  }
  await clearSessionCookie();
  redirect("/login");
}

export async function changePassword(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const blocked = await guardedForm(formData);
  if (blocked) return { error: blocked };

  const current = await getCurrentUser();
  if (!current) redirect("/login");

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: "Use 12 to 128 characters, and make both new passwords match." };
  }

  try {
    if (await isPasswordChangeRateLimited(current.id)) {
      return { error: "Too many attempts. Try again later." };
    }
    await recordPasswordChangeAttempt(current.id);

    const user = await getDb().user.findUnique({
      where: { id: current.id },
      select: { id: true, passwordHash: true, status: true },
    });
    if (!user || user.status !== "ACTIVE") {
      await revokeSession(current.sessionId);
      await clearSessionCookie();
      redirect("/login");
    }

    const passwordOk = await verifyPassword(user.passwordHash, parsed.data.currentPassword);
    if (!passwordOk) return { error: "The current password is not correct." };

    const passwordHash = await hashPassword(parsed.data.newPassword);
    const revokedAt = new Date();
    await getDb().$transaction([
      getDb().user.update({
        where: { id: user.id },
        data: { passwordHash },
        select: { id: true },
      }),
      getDb().session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt },
      }),
      getDb().auditLog.create({
        data: {
          actorId: user.id,
          action: "auth.password.change",
          targetType: "user",
          targetId: user.id,
          requestId: crypto.randomUUID(),
        },
      }),
    ]);
  } catch (error) {
    unstable_rethrow(error);
    console.error("auth.password", error instanceof Error ? error.name : "error");
    return { error: genericFailure };
  }

  await clearSessionCookie();
  redirect("/login?changed=1");
}
