import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookieBase, CSRF_HEADER, csrfCookieName, sessionCookieName } from "@/server/auth/constants";
import { isSameOrigin } from "@/server/auth/origin";

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isMutation(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

export function proxy(request: NextRequest) {
  if (isMutation(request.method) && !isSameOrigin(request.headers.get("origin"), request.headers.get("host"))) {
    return new NextResponse(null, { status: 403 });
  }

  const csrfName = csrfCookieName();
  const existingCsrf = request.cookies.get(csrfName)?.value;
  const csrf = existingCsrf ?? randomToken();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSRF_HEADER, csrf);

  const requestId = request.headers.get("x-request-id") ?? randomToken();
  requestHeaders.set("x-request-id", requestId);

  const hasSession = request.cookies.has(sessionCookieName());
  const pathname = request.nextUrl.pathname;
  const isPublic = pathname === "/login" || pathname === "/health" || pathname === "/health/ready";
  const response = !hasSession && !isPublic
    ? NextResponse.redirect(new URL("/login", request.url))
    : NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);

  if (!existingCsrf && !pathname.startsWith("/health")) {
    response.cookies.set(csrfName, csrf, cookieBase());
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico)$).*)"],
};
