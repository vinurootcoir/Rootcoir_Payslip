"use server";

import { createHash, randomBytes } from "crypto";
import { logFailure } from "@/lib/log";
import { getEnv } from "@/lib/env";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/server/db";
import { sendTextMail } from "@/server/email/smtp";
import { writeAudit } from "./audit";
import { clientAddress, csrfIsValid, requestIsSameOrigin } from "./request";
import { dummyPasswordHash, hashPassword, verifyPassword } from "./password";
import { verifyRecaptcha } from "./recaptcha";
import {
  isLoginRateLimited,
  isPasswordChangeRateLimited,
  isPasswordResetRateLimited,
  recordLoginAttempt,
  recordPasswordChangeAttempt,
  recordPasswordResetAttempt,
} from "./rate-limit";
import { clearSessionCookie, createSession, forgetCachedUser, getCurrentUser, revokeSession } from "./session";

export type FormState = { error: string | null; message?: string | null };

const expiredForm = "The form expired. Refresh the page and try again.";
const genericLogin = "Invalid email or password.";
const genericFailure = "Something went wrong. Try again.";
const resetAck =
  "If that email is registered, we sent a reset link. Check your inbox.";

const RESET_TTL_MS = 60 * 60 * 1000;

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(6).max(128),
    confirmPassword: z.string().min(6).max(128),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
  });

const resetPasswordSchema = z
  .object({
    token: z.string().min(32).max(128),
    newPassword: z.string().min(6).max(128),
    confirmPassword: z.string().min(6).max(128),
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

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function requestOrigin(): Promise<string | null> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return null;
  const proto =
    headerList.get("x-forwarded-proto") ??
    (getEnv().nodeEnv === "production" ? "https" : "http");
  return `${proto}://${host}`;
}

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  const blocked = await guardedForm(formData);
  if (blocked) return { error: blocked };

  const captcha = await verifyRecaptcha(formData.get("recaptchaToken"), "login");
  if (captcha) return { error: captcha };

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
    logFailure("auth.login", error);
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
    return { error: "Use 6 to 128 characters, and make both new passwords match." };
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
    forgetCachedUser(user.id);
  } catch (error) {
    unstable_rethrow(error);
    logFailure("auth.password", error);
    return { error: genericFailure };
  }

  await clearSessionCookie();
  redirect("/login?changed=1");
}

export async function requestPasswordReset(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const blocked = await guardedForm(formData);
  if (blocked) return { error: blocked };

  const captcha = await verifyRecaptcha(formData.get("recaptchaToken"), "forgot_password");
  if (captcha) return { error: captcha };

  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Enter a valid email address." };

  const headerList = await headers();
  const ip = clientAddress(headerList);

  try {
    if (await isPasswordResetRateLimited(parsed.data.email, ip)) {
      return { error: "Too many attempts. Try again later." };
    }
    await recordPasswordResetAttempt(parsed.data.email, ip);

    const user = await getDb().user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true, status: true },
    });

    if (user && user.status === "ACTIVE") {
      const smtp = getEnv().smtp;
      if (!smtp) {
        logFailure("auth.password.reset.request", new Error("SMTP is not configured"));
        return { error: "Email is not configured. Contact an administrator." };
      }

      const origin = await requestOrigin();
      if (!origin) return { error: genericFailure };

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = hashResetToken(rawToken);
      const expiresAt = new Date(Date.now() + RESET_TTL_MS);

      await getDb().$transaction([
        getDb().passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        }),
        getDb().passwordResetToken.create({
          data: { userId: user.id, tokenHash, expiresAt },
        }),
      ]);

      const resetUrl = `${origin}/reset-password?token=${rawToken}`;
      await sendTextMail(smtp, {
        to: user.email,
        subject: "Reset your payslip portal password",
        text: [
          "We received a request to reset your password.",
          "",
          `Open this link within one hour to choose a new password:`,
          resetUrl,
          "",
          "If you did not ask for this, you can ignore this email.",
        ].join("\n"),
      });

      await writeAudit({
        actorId: user.id,
        action: "auth.password.reset.request",
        targetType: "user",
        targetId: user.id,
      });
    }
  } catch (error) {
    unstable_rethrow(error);
    logFailure("auth.password.reset.request", error);
    return { error: genericFailure };
  }

  return { error: null, message: resetAck };
}

export async function resetPassword(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const blocked = await guardedForm(formData);
  if (blocked) return { error: blocked };

  const captcha = await verifyRecaptcha(formData.get("recaptchaToken"), "reset_password");
  if (captcha) return { error: captcha };

  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: "Use 6 to 128 characters, and make both new passwords match." };
  }

  try {
    const tokenHash = hashResetToken(parsed.data.token);
    const reset = await getDb().passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        user: { select: { id: true, status: true } },
      },
    });

    if (
      !reset ||
      reset.usedAt ||
      reset.expiresAt.getTime() < Date.now() ||
      reset.user.status !== "ACTIVE"
    ) {
      return { error: "This reset link is invalid or has expired." };
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    const revokedAt = new Date();
    await getDb().$transaction([
      getDb().passwordResetToken.update({
        where: { id: reset.id },
        data: { usedAt: revokedAt },
      }),
      getDb().passwordResetToken.updateMany({
        where: { userId: reset.userId, usedAt: null, id: { not: reset.id } },
        data: { usedAt: revokedAt },
      }),
      getDb().user.update({
        where: { id: reset.userId },
        data: { passwordHash },
        select: { id: true },
      }),
      getDb().session.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt },
      }),
      getDb().auditLog.create({
        data: {
          actorId: reset.userId,
          action: "auth.password.reset.complete",
          targetType: "user",
          targetId: reset.userId,
          requestId: crypto.randomUUID(),
        },
      }),
    ]);
    forgetCachedUser(reset.userId);
  } catch (error) {
    unstable_rethrow(error);
    logFailure("auth.password.reset.complete", error);
    return { error: genericFailure };
  }

  await clearSessionCookie();
  redirect("/login?changed=1");
}
