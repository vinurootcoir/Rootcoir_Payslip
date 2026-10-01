export const JWT_ISSUER = "payslip";
export const JWT_AUDIENCE = "payslip-portal";
export const CSRF_HEADER = "x-csrf-token";

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function sessionCookieName(): string {
  return isProduction() ? "__Host-session" : "session";
}

export function csrfCookieName(): string {
  return isProduction() ? "__Host-csrf" : "csrf";
}

export function cookieBase() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
  };
}
