import assert from "node:assert/strict";
import test from "node:test";
import { auditSummary, canChangeAccess, employeeCanSeePayslip, loginForNewUser, parsePayslipYear } from "../src/server/access/policy";

const employeeId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";

test("an employee sees only their own finalized or voided payslips", () => {
  assert.equal(employeeCanSeePayslip(employeeId, { employeeId, status: "FINALIZED" }), true);
  assert.equal(employeeCanSeePayslip(employeeId, { employeeId, status: "VOID" }), true);
  assert.equal(employeeCanSeePayslip(employeeId, { employeeId, status: "DRAFT" }), false);
  assert.equal(employeeCanSeePayslip(employeeId, { employeeId: otherId, status: "FINALIZED" }), false);
  assert.equal(employeeCanSeePayslip(null, { employeeId, status: "FINALIZED" }), false);
});

test("employee logins use the employee work email, not a typed address", () => {
  const login = loginForNewUser({
    role: "USER",
    employeeEmail: "Asha@Example.com",
    employeeAlreadyLinked: false,
    accountEmail: "attacker@example.com",
  });
  assert.equal(login.ok, true);
  if (login.ok) {
    assert.equal(login.email, "asha@example.com");
    assert.equal(login.linkEmployee, true);
  }
  assert.equal(loginForNewUser({
    role: "ADMIN",
    employeeEmail: "asha@example.com",
    employeeAlreadyLinked: false,
    accountEmail: "Admin@Example.com",
  }).ok, true);
  const admin = loginForNewUser({
    role: "ADMIN",
    employeeEmail: "asha@example.com",
    employeeAlreadyLinked: false,
    accountEmail: "Admin@Example.com",
  });
  if (admin.ok) assert.equal(admin.email, "admin@example.com");
  assert.equal(loginForNewUser({
    role: "USER",
    employeeEmail: null,
    employeeAlreadyLinked: false,
    accountEmail: "attacker@example.com",
  }).ok, false);
});

test("access changes cannot remove the last Super Admin or your own account", () => {
  const base = {
    actorId: "actor",
    targetId: "target",
    targetRole: "SUPER_ADMIN" as const,
    targetStatus: "ACTIVE" as const,
    nextRole: "ADMIN" as const,
    nextStatus: "ACTIVE" as const,
    activeSuperAdmins: 1,
  };
  assert.equal(canChangeAccess(base).ok, false);
  assert.equal(canChangeAccess({ ...base, activeSuperAdmins: 2 }).ok, true);
  assert.equal(canChangeAccess({ ...base, actorId: "target", targetId: "target", activeSuperAdmins: 2 }).ok, false);
  assert.equal(canChangeAccess({ ...base, targetRole: "USER", nextRole: "ADMIN", activeSuperAdmins: 2 }).ok, false);
  const deactivate = canChangeAccess({ ...base, targetRole: "ADMIN", nextRole: "ADMIN", nextStatus: "INACTIVE", activeSuperAdmins: 2 });
  assert.equal(deactivate.ok, true);
  if (deactivate.ok) assert.equal(deactivate.revokeSessions, true);
});

test("audit summaries omit salary fields", () => {
  assert.equal(auditSummary({ status: "SENT", netPay: "987654.32", fields: ["components"] }), "SENT · components");
  assert.equal(auditSummary({ netPay: "987654.32" }), null);
  assert.equal(parsePayslipYear("2026"), 2026);
  assert.equal(parsePayslipYear("1999"), null);
  assert.equal(parsePayslipYear("all"), null);
});
