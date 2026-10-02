import assert from "node:assert/strict";
import test from "node:test";
import { bindDeliveryMail, renderPayslipEmail, toSmtpOptions } from "../src/server/email/message";
import {
  cappedChunkLimit,
  classifyMailError,
  decideDeliveryOutcome,
  isSendable,
  retryDelayMs,
  rollupBatchStatus,
  STALE_SENDING_MS,
} from "../src/server/email/outcome";
import { planEmailBatch, planResend } from "../src/server/email/plan";
import { processEmailChunk, type ClaimedDelivery, type EmailQueueAdapter, type MailSender } from "../src/server/email/process";
import type { PayslipSnapshot } from "../src/server/payroll/snapshot";

const recordId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";

function candidate(overrides: Partial<Parameters<typeof planEmailBatch>[0][number]> = {}) {
  return {
    payrollRecordId: recordId,
    recordStatus: "FINALIZED" as const,
    employeeStatus: "ACTIVE" as const,
    workEmail: "Asha@Example.com",
    fullName: "Asha Menon",
    deliveries: [],
    ...overrides,
  };
}

function snapshot(payslipNumber: string, netPay: string): PayslipSnapshot {
  return {
    version: 1,
    company: { name: "Root Coir", address: "Mill Road", currency: "INR" },
    employee: {
      fullName: "Asha Menon",
      employeeNumber: "RC-014",
      designation: "Operator",
      department: "Production",
      dateOfJoining: "2020-04-01",
      pan: null,
      uan: null,
      esiNumber: null,
    },
    attendance: { totalWorkingDays: "26.00", paidDays: "26.00", lopDays: "0.00" },
    earnings: {
      basicSalary: netPay,
      hra: "0.00",
      specialAllowance: "0.00",
      otherAllowances: "0.00",
      overtime: null,
      bonus: null,
      grossEarnings: netPay,
    },
    deductions: {
      employeePf: null,
      employeeEsi: null,
      professionalTax: null,
      tds: null,
      salaryAdvance: null,
      otherDeductions: null,
      totalDeductions: "0.00",
    },
    netPay,
    amountInWords: "Nine Lakh Eighty Seven Thousand Six Hundred Fifty Four Rupees and Thirty Two Paise Only",
    payslipNumber,
  };
}

test("email planning uses the employee record and skips duplicates", () => {
  const ready = planEmailBatch([candidate(), candidate({ payrollRecordId: otherId, workEmail: "not-an-email", fullName: "Other" })], { mode: "all" });
  assert.equal(ready.queue.length, 1);
  assert.equal(ready.queue[0]?.email, "asha@example.com");
  assert.equal(ready.queue[0]?.idempotencyKey, `payslip:${recordId}`);
  assert.equal(ready.skipped[0]?.reason, "invalid_email");

  const again = planEmailBatch([candidate({ deliveries: [{ status: "SENT" }] })], { mode: "all" });
  assert.equal(again.queue.length, 0);
  assert.equal(again.skipped[0]?.reason, "already_sent");

  const selected = planEmailBatch(
    [candidate(), candidate({ payrollRecordId: otherId, workEmail: "other@example.com", fullName: "Other" })],
    { mode: "ids", ids: [otherId] },
  );
  assert.deepEqual(selected.queue.map((item) => item.email), ["other@example.com"]);

  assert.equal(planEmailBatch([candidate({ recordStatus: "DRAFT" })], { mode: "all" }).skipped[0]?.reason, "not_finalized");
  assert.equal(planEmailBatch([candidate({ recordStatus: "VOID" })], { mode: "all" }).skipped[0]?.reason, "not_finalized");
  assert.equal(planEmailBatch([candidate({ employeeStatus: "INACTIVE" })], { mode: "all" }).skipped[0]?.reason, "inactive");
  assert.equal(planEmailBatch([candidate({ deliveries: [{ status: "QUEUED" }] })], { mode: "all" }).skipped[0]?.reason, "in_flight");
  assert.equal(planEmailBatch([candidate({ deliveries: [{ status: "FAILED" }] })], { mode: "all" }).skipped[0]?.reason, "needs_retry");
});

test("resend is explicit and gets a new idempotency key", () => {
  const sent = candidate({ deliveries: [{ status: "SENT" }] });
  const planned = planResend(sent);
  assert.equal(planned.ok, true);
  if (planned.ok) assert.equal(planned.idempotencyKey, `payslip:${recordId}:resend:1`);
  assert.equal(planResend(candidate()).ok, false);
  assert.equal(planResend({ ...sent, deliveries: [...sent.deliveries, { status: "RETRYING" }] }).ok, false);
});

test("payslip email omits salary and sends one attachment to one recipient", () => {
  const net = "987654.32";
  const words = "Nine Lakh Eighty Seven Thousand Six Hundred Fifty Four Rupees and Thirty Two Paise Only";
  const slip = snapshot("PS2026040001", net);
  const rendered = renderPayslipEmail({
    subjectTemplate: "Pay {{netPay}} {{payrollMonth}}",
    bodyTemplate: "Net {{netPay}} for {{employeeName}} is attached.",
    companyName: slip.company.name,
    employeeName: "Asha Menon",
    payrollMonth: "April 2026",
    payslipNumber: slip.payslipNumber,
  });
  assert.equal(rendered.subject.includes(net), false);
  assert.equal(rendered.text.includes(net), false);
  assert.equal(rendered.text.includes(words), false);
  assert.equal(rendered.subject.includes("April 2026"), true);
  assert.equal(rendered.text.includes("Asha Menon"), true);

  const first = bindDeliveryMail({ recipientEmail: "asha@example.com", payrollRecordId: recordId }, slip, Buffer.from("one"), rendered);
  const second = bindDeliveryMail(
    { recipientEmail: "other@example.com", payrollRecordId: otherId },
    snapshot("PS2026040002", "10.00"),
    Buffer.from("two"),
    rendered,
  );
  assert.equal(first.to, "asha@example.com");
  assert.equal(first.filename, "PS2026040001.pdf");
  assert.equal(second.to, "other@example.com");
  assert.equal(second.filename, "PS2026040002.pdf");
  assert.equal(first.content.toString(), "one");
  assert.equal(second.content.toString(), "two");

  const smtp = toSmtpOptions("payroll@example.com", first);
  assert.deepEqual(Object.keys(smtp).sort(), ["attachments", "from", "subject", "text", "to"]);
  assert.equal(smtp.to, "asha@example.com");
  assert.equal(smtp.attachments.length, 1);
});

test("retries back off, stop on configuration errors, and cap each chunk", async () => {
  assert.equal(cappedChunkLimit(100), 10);
  assert.equal(retryDelayMs(1), 60_000);
  assert.equal(retryDelayMs(2), 120_000);
  assert.equal(retryDelayMs(20), 30 * 60 * 1000);
  const now = new Date("2026-04-02T00:00:00.000Z");
  assert.equal(isSendable({ status: "RETRYING", attempts: 1, updatedAt: now }, now), false);
  assert.equal(isSendable({ status: "RETRYING", attempts: 1, updatedAt: new Date(now.getTime() - 61_000) }, now), true);
  assert.equal(isSendable({ status: "SENDING", attempts: 1, updatedAt: new Date(now.getTime() - 1000) }, now), false);
  assert.equal(isSendable({ status: "SENDING", attempts: 1, updatedAt: new Date(now.getTime() - STALE_SENDING_MS) }, now), true);
  assert.equal(decideDeliveryOutcome(1, { ok: false, kind: "transient", message: "try later" }).status, "RETRYING");
  assert.equal(decideDeliveryOutcome(5, { ok: false, kind: "transient", message: "try later" }).status, "FAILED");
  assert.equal(decideDeliveryOutcome(1, { ok: false, kind: "permanent", message: "no such mailbox" }).status, "FAILED");
  assert.equal(decideDeliveryOutcome(1, { ok: false, kind: "configuration", message: "login" }).stop, true);
  assert.equal(classifyMailError({ code: "EAUTH", message: "bad secret" }).message, "Mail server rejected the login.");
  assert.equal(classifyMailError(new Error("mailbox missing for asha@example.com")).message.includes("asha@example.com"), false);
  assert.equal(rollupBatchStatus({ sent: 2, failed: 1, pending: 0 }), "COMPLETED_WITH_ERRORS");
  assert.equal(rollupBatchStatus({ sent: 0, failed: 0, pending: 3 }), "QUEUED");

  const rows: (ClaimedDelivery & { status: "QUEUED" | "SENT" | "FAILED" | "RETRYING" })[] = Array.from({ length: 12 }, (_, index) => ({
    id: `delivery-${index}`,
    batchId: "batch-1",
    payrollRecordId: recordId,
    recipientEmail: `person${index}@example.com`,
    recipientName: `Person ${index}`,
    attempts: 0,
    status: "QUEUED" as const,
  }));
  const sentTo: string[] = [];
  const adapter: EmailQueueAdapter = {
    async failStale() {},
    async claim(limit) {
      const next = rows.find((row) => row.status === "QUEUED");
      if (!next || limit < 1) return [];
      next.status = "SENT";
      next.attempts += 1;
      return [{ ...next }];
    },
    async loadMail(delivery) {
      return {
        to: delivery.recipientEmail,
        subject: "Payslip",
        text: "Attached",
        filename: "PS2026040001.pdf",
        content: Buffer.from(delivery.payrollRecordId),
      };
    },
    async finish(delivery, decision) {
      const row = rows.find((item) => item.id === delivery.id);
      if (row) row.status = decision.status;
    },
  };
  const sender: MailSender = {
    async send(mail) {
      sentTo.push(mail.to);
      if (mail.to === "person1@example.com") {
        const error = new Error("timeout") as Error & { code: string };
        error.code = "ETIMEDOUT";
        throw error;
      }
      if (mail.to === "person2@example.com") {
        const error = new Error("login") as Error & { code: string };
        error.code = "EAUTH";
        throw error;
      }
      return { response: "250 ok" };
    },
  };

  const chunk = await processEmailChunk(adapter, sender, { limit: 100, pauseMs: 0, sleep: async () => {} });
  assert.equal(chunk.claimed, 3);
  assert.equal(chunk.stopped, true);
  assert.equal(sentTo.length, 3);
  assert.deepEqual(sentTo, ["person0@example.com", "person1@example.com", "person2@example.com"]);
  assert.equal(rows[0]?.status, "SENT");
  assert.equal(rows[1]?.status, "RETRYING");
  assert.equal(rows[2]?.status, "RETRYING");
  assert.equal(rows[3]?.status, "QUEUED");

  const mismatched: EmailQueueAdapter = {
    ...adapter,
    async claim() {
      return [
        {
          id: "bad",
          batchId: "batch-1",
          payrollRecordId: otherId,
          recipientEmail: "asha@example.com",
          recipientName: "Asha",
          attempts: 1,
        },
      ];
    },
    async loadMail() {
      return {
        to: "other@example.com",
        subject: "Payslip",
        text: "Attached",
        filename: "PS2026040002.pdf",
        content: Buffer.from("wrong"),
      };
    },
    async finish(_delivery, decision) {
      assert.equal(decision.status, "FAILED");
    },
  };
  let called = false;
  const guarded = await processEmailChunk(mismatched, { async send() { called = true; return { response: "250" }; } }, { limit: 1, pauseMs: 0 });
  assert.equal(called, false);
  assert.equal(guarded.failed, 1);
});
