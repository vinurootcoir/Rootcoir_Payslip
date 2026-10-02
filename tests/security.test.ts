import assert from "node:assert/strict";
import test from "node:test";
import { isOverWindowLimit } from "../src/lib/limits";
import { securityHeaders } from "../src/lib/security-headers";
import { cookieAttributes, csrfCookieNameFor, sessionCookieNameFor } from "../src/server/auth/constants";
import { employeeListHidesSensitiveIdentifiers, employeeListSelect } from "../src/server/employees/list-fields";

test("production session cookies are host-only and secure", () => {
  const production = cookieAttributes(true);
  assert.equal(production.httpOnly, true);
  assert.equal(production.secure, true);
  assert.equal(production.sameSite, "lax");
  assert.equal(production.path, "/");
  assert.equal(sessionCookieNameFor(true), "__Host-session");
  assert.equal(csrfCookieNameFor(true), "__Host-csrf");
  assert.equal(cookieAttributes(false).secure, false);
  assert.equal(sessionCookieNameFor(false), "session");
});

test("the content security policy stays on this origin", () => {
  const production = Object.fromEntries(securityHeaders(true).map((header) => [header.key, header.value]));
  assert.match(production["Content-Security-Policy"], /default-src 'self'/);
  assert.match(production["Content-Security-Policy"], /object-src 'none'/);
  assert.match(production["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.equal(production["Content-Security-Policy"].includes("'unsafe-eval'"), false);
  assert.equal(production["Strict-Transport-Security"], "max-age=63072000; includeSubDomains");
  assert.equal(production["X-Frame-Options"], "DENY");
  assert.equal(production["X-Content-Type-Options"], "nosniff");

  const development = Object.fromEntries(securityHeaders(false).map((header) => [header.key, header.value]));
  assert.match(development["Content-Security-Policy"], /'unsafe-eval'/);
  assert.equal("Strict-Transport-Security" in development, false);
});

test("employee lists omit PAN, UAN, and ESI", () => {
  assert.equal(employeeListHidesSensitiveIdentifiers(Object.keys(employeeListSelect)), true);
  assert.equal(employeeListHidesSensitiveIdentifiers(["fullName", "pan"]), false);
});

test("email actions stop at the window limit", () => {
  assert.equal(isOverWindowLimit(29), false);
  assert.equal(isOverWindowLimit(30), true);
});
