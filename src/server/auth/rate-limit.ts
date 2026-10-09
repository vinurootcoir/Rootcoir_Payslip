import "server-only";
import { createHash } from "crypto";
import { EMAIL_ACTION_LIMIT, EMAIL_ACTION_WINDOW_MS, isOverWindowLimit } from "@/lib/limits";
import { getDb } from "@/server/db";

const WINDOW_MS = 15 * 60 * 1000;
const EMAIL_LIMIT = 5;
const IP_LIMIT = 30;
const PASSWORD_LIMIT = 5;

function digest(kind: string, value: string): string {
  return `${kind}:${createHash("sha256").update(value).digest("hex")}`;
}

async function countSince(identifier: string, since: Date): Promise<number> {
  return getDb().loginAttempt.count({
    where: { identifier, createdAt: { gte: since } },
  });
}

export async function isLoginRateLimited(email: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  if ((await countSince(digest("email", email), since)) >= EMAIL_LIMIT) return true;
  if (ip === "unknown") return false;
  return (await countSince(digest("ip", ip), since)) >= IP_LIMIT;
}

export async function recordLoginAttempt(email: string, ip: string): Promise<void> {
  const since = new Date(Date.now() - WINDOW_MS);
  const identifiers = [digest("email", email)];
  if (ip !== "unknown") identifiers.push(digest("ip", ip));

  await getDb().loginAttempt.deleteMany({
    where: { identifier: { in: identifiers }, createdAt: { lt: since } },
  });
  await getDb().loginAttempt.createMany({
    data: identifiers.map((identifier) => ({ identifier })),
  });
}

export async function isPasswordChangeRateLimited(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  return (await countSince(digest("password", userId), since)) >= PASSWORD_LIMIT;
}

export async function isEmailActionRateLimited(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - EMAIL_ACTION_WINDOW_MS);
  const count = await countSince(digest("email-action", userId), since);
  return isOverWindowLimit(count, EMAIL_ACTION_LIMIT);
}

export async function recordEmailAction(userId: string): Promise<void> {
  const since = new Date(Date.now() - EMAIL_ACTION_WINDOW_MS);
  const identifier = digest("email-action", userId);
  await getDb().loginAttempt.deleteMany({
    where: { identifier, createdAt: { lt: since } },
  });
  await getDb().loginAttempt.create({ data: { identifier } });
}

export async function recordPasswordChangeAttempt(userId: string): Promise<void> {
  const since = new Date(Date.now() - WINDOW_MS);
  const identifier = digest("password", userId);
  await getDb().loginAttempt.deleteMany({
    where: { identifier, createdAt: { lt: since } },
  });
  await getDb().loginAttempt.create({ data: { identifier } });
}

export async function isPasswordResetRateLimited(email: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  if ((await countSince(digest("reset-email", email), since)) >= EMAIL_LIMIT) return true;
  if (ip === "unknown") return false;
  return (await countSince(digest("reset-ip", ip), since)) >= IP_LIMIT;
}

export async function recordPasswordResetAttempt(email: string, ip: string): Promise<void> {
  const since = new Date(Date.now() - WINDOW_MS);
  const identifiers = [digest("reset-email", email)];
  if (ip !== "unknown") identifiers.push(digest("reset-ip", ip));

  await getDb().loginAttempt.deleteMany({
    where: { identifier: { in: identifiers }, createdAt: { lt: since } },
  });
  await getDb().loginAttempt.createMany({
    data: identifiers.map((identifier) => ({ identifier })),
  });
}
