export const JWT_ISSUER = "payslip";
export const JWT_AUDIENCE = "payslip-portal";
export const CSRF_HEADER = "x-csrf-token";

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function sessionCookieNameFor(production: boolean): string {
  return production ? "__Host-session" : "session";
}

export function csrfCookieNameFor(production: boolean): string {
  return production ? "__Host-csrf" : "csrf";
}

export function sessionCookieName(): string {
  return sessionCookieNameFor(isProduction());
}

export function csrfCookieName(): string {
  return csrfCookieNameFor(isProduction());
}

export function cookieAttributes(production: boolean) {
  return {
    httpOnly: true as const,
    secure: production,
    sameSite: "lax" as const,
    path: "/",
  };
}

export function cookieBase() {
  return cookieAttributes(isProduction());
}
