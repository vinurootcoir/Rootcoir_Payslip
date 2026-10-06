import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { UserRole } from "@prisma/client";
import { getDb } from "@/server/db";
import { cookieBase, sessionCookieName } from "./constants";
import { readSessionToken, sessionTtlSeconds, signSessionToken } from "./token";

export type CurrentUser = {
  id: string;
  email: string;
  role: UserRole;
  employeeId: string | null;
  sessionId: string;
};

export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + sessionTtlSeconds() * 1000);
  const session = await getDb().session.create({
    data: { userId, expiresAt },
    select: { id: true },
  });
  const token = await signSessionToken({ sessionId: session.id, userId });
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(), token, {
    ...cookieBase(),
    maxAge: sessionTtlSeconds(),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(), "", {
    ...cookieBase(),
    maxAge: 0,
  });
}

const SESSION_CACHE_MS = 20_000;
const sessionCache = new Map<string, { at: number; user: CurrentUser }>();

export function forgetCachedSession(sessionId: string): void {
  sessionCache.delete(sessionId);
}

export function forgetCachedUser(userId: string): void {
  for (const [sessionId, entry] of sessionCache) {
    if (entry.user.id === userId) sessionCache.delete(sessionId);
  }
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  if (!token) return null;

  const claims = await readSessionToken(token);
  if (!claims) return null;

  const cached = sessionCache.get(claims.sessionId);
  if (cached && Date.now() - cached.at < SESSION_CACHE_MS && cached.user.id === claims.userId) {
    return cached.user;
  }

  const session = await getDb().session.findUnique({
    where: { id: claims.sessionId },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          employeeId: true,
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    sessionCache.delete(claims.sessionId);
    return null;
  }
  if (session.userId !== claims.userId || session.user.id !== claims.userId) return null;
  if (session.user.status !== "ACTIVE") {
    sessionCache.delete(claims.sessionId);
    return null;
  }

  const user: CurrentUser = {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    employeeId: session.user.employeeId,
    sessionId: session.id,
  };
  sessionCache.set(session.id, { at: Date.now(), user });
  return user;
});

export async function revokeSession(sessionId: string): Promise<void> {
  forgetCachedSession(sessionId);
  await getDb().session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeUserSessions(userId: string): Promise<void> {
  forgetCachedUser(userId);
  await getDb().session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
