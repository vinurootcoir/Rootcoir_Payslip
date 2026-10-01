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

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  if (!token) return null;

  const claims = await readSessionToken(token);
  if (!claims) return null;

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

  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  if (session.userId !== claims.userId || session.user.id !== claims.userId) return null;
  if (session.user.status !== "ACTIVE") return null;

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    employeeId: session.user.employeeId,
    sessionId: session.id,
  };
});

export async function revokeSession(sessionId: string): Promise<void> {
  await getDb().session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeUserSessions(userId: string): Promise<void> {
  await getDb().session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
