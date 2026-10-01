import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { getEnv } from "@/lib/env";
import { parseDurationSeconds } from "@/lib/duration";
import { JWT_AUDIENCE, JWT_ISSUER } from "./constants";

export type SessionClaims = {
  sessionId: string;
  userId: string;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().jwtSecret);
}

export function sessionTtlSeconds(): number {
  return parseDurationSeconds(getEnv().jwtExpiry);
}

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ sid: claims.sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(`${sessionTtlSeconds()}s`)
    .sign(secretKey());
}

export async function readSessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
      return null;
    }

    return { userId: payload.sub, sessionId: payload.sid };
  } catch {
    return null;
  }
}
