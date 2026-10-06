import assert from "node:assert/strict";
import test from "node:test";
import { canDownloadPayslip } from "../src/server/payroll/pdf-access";
import { renderPayslipPdf } from "../src/server/payroll/pdf";
import { buildPayslipDocument, pdfFilename } from "../src/server/payroll/payslip-document";
import type { PayslipSnapshot } from "../src/server/payroll/snapshot";

const employeeId = "11111111-1111-4111-8111-111111111111";
const otherEmployeeId = "22222222-2222-4222-8222-222222222222";

function snapshot(overrides: Partial<PayslipSnapshot> = {}): PayslipSnapshot {
  return {
    version: 1,
    company: {
      name: "Root Coir",
      address: "12 Mill Road\nAlleppey",
      currency: "INR",
      ...overrides.company,
    },
    employee: {
      fullName: "Asha Menon",
      employeeNumber: "RC-014",
      designation: "Operator",
      department: "Production",
      dateOfJoining: "2020-04-01",
      pan: "ABCDE1234F",
      uan: null,
      esiNumber: null,
      ...overrides.employee,
    },
    attendance: {
      totalWorkingDays: "26.00",
      paidDays: "24.00",
      lopDays: "2.00",
      ...overrides.attendance,
    },
    earnings: {
      basicSalary: "10000.00",
      hra: "5000.00",
      specialAllowance: "0.00",
      otherAllowances: "0.00",
      overtime: null,
      bonus: null,
      grossEarnings: "15000.00",
      ...overrides.earnings,
    },
    deductions: {
      employeePf: null,
      employeeEsi: null,
      professionalTax: null,
      tds: null,
      salaryAdvance: null,
      otherDeductions: null,
      totalDeductions: "0.00",
      ...overrides.deductions,
    },
    netPay: "15000.00",
    amountInWords: "Fifteen Thousand Rupees Only",
    payslipNumber: "PS2026040001",
    ...overrides,
  };
}

function labels(document: ReturnType<typeof buildPayslipDocument>): string[] {
  return document.blocks.flatMap((block) => (block.kind === "rows" ? block.rows.map((row) => row.label) : []));
}

function value(document: ReturnType<typeof buildPayslipDocument>, label: string): string | undefined {
  for (const block of document.blocks) {
    if (block.kind !== "rows") continue;
    const match = block.rows.find((row) => row.label === label);
    if (match) return match.value;
  }
  return undefined;
}

test("payslip document uses the snapshot figures and month", () => {
  const document = buildPayslipDocument(snapshot({ netPay: "1.00", amountInWords: "One Rupee Only" }), {
    year: 2026,
    month: 4,
    revision: 2,
    status: "FINALIZED",
    voidReason: null,
  });
  const rupee = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
  assert.equal(value(document, "Payroll month"), "April 2026");
  assert.equal(value(document, "Payslip number"), "PS2026040001");
  assert.equal(value(document, "Net pay"), rupee.format(1));
  assert.equal(value(document, "Gross earnings"), rupee.format(15000));
  assert.equal(value(document, "Amount in words"), "One Rupee Only");
  assert.equal(document.filename, "PS2026040001.pdf");
});

test("optional earnings, deductions, and identifiers are omitted when absent", () => {
  const document = buildPayslipDocument(snapshot(), {
    year: 2026,
    month: 4,
    revision: 1,
    status: "FINALIZED",
    voidReason: null,
  });
  const shown = labels(document);
  for (const omitted of ["Overtime", "Bonus / incentive", "Employee PF", "Employee ESI", "Professional tax", "TDS", "Salary advance / loan", "Other deductions", "UAN", "ESI number"]) {
    assert.equal(shown.includes(omitted), false, omitted);
  }
  assert.equal(shown.includes("PAN"), true);
  assert.equal(shown.includes("Total deductions"), true);
  assert.equal(document.blocks.some((block) => block.title === "Statutory / identification"), true);
});

test("statutory section is omitted when no identifiers are stored", () => {
  const document = buildPayslipDocument(snapshot({ employee: { ...snapshot().employee, pan: "  ", uan: null, esiNumber: null } }), {
    year: 2026,
    month: 4,
    revision: 1,
    status: "FINALIZED",
    voidReason: null,
  });
  assert.equal(document.blocks.some((block) => block.title === "Statutory / identification"), false);
  assert.equal(labels(document).includes("PAN"), false);
});

test("long company, employee, and amount text is kept in full", () => {
  const companyName = `Root ${"Coir ".repeat(80)}`;
  const employeeName = `Asha ${"Menon ".repeat(40)}`;
  const words = `Rupees ${"Only ".repeat(60)}`;
  const address = Array.from({ length: 12 }, (_, index) => `Line ${index} ${"Road ".repeat(30)}`).join("\n");
  const document = buildPayslipDocument(
    snapshot({
      company: { name: companyName, address, currency: "INR" },
      employee: { ...snapshot().employee, fullName: employeeName },
      amountInWords: words,
    }),
    { year: 2026, month: 4, revision: 1, status: "FINALIZED", voidReason: null },
  );
  assert.equal(document.companyName, companyName.trim());
  assert.equal(document.employeeName, employeeName.trim());
  assert.equal(document.companyAddress.length, 12);
  assert.equal(document.companyAddress[11]?.includes("Line 11"), true);
  assert.equal(value(document, "Amount in words"), words.trim());
  assert.equal(value(document, "Name"), employeeName.trim());
});

test("voided payslips keep the recorded reason", () => {
  const document = buildPayslipDocument(snapshot(), {
    year: 2026,
    month: 4,
    revision: 3,
    status: "VOID",
    voidReason: "Wrong paid days",
  });
  assert.equal(document.notice, "This payslip was voided. Wrong paid days");
  assert.equal(value(document, "Status"), "Void");
});

test("pdf filename strips characters that are unsafe in a download name", () => {
  assert.equal(pdfFilename("PS2026040001"), "PS2026040001.pdf");
  assert.equal(pdfFilename("PS/2026 04"), "PS202604.pdf");
});

test("a payslip stays on the salary slip page", async () => {
  const short = await renderPayslipPdf(
    buildPayslipDocument(snapshot(), {
      year: 2026,
      month: 4,
      revision: 1,
      status: "FINALIZED",
      voidReason: null,
    }),
  );
  assert.equal(short.bytes.subarray(0, 5).toString(), "%PDF-");
  assert.equal(short.pageCount, 1);

  const longAddress = Array.from({ length: 90 }, (_, index) => `Warehouse bay ${index}, ${"Industrial Estate ".repeat(6)}`).join("\n");
  const long = await renderPayslipPdf(
    buildPayslipDocument(
      snapshot({
        company: { name: "Root Coir", address: longAddress, currency: "INR" },
        employee: { ...snapshot().employee, fullName: "José ₹ Menon" },
      }),
      { year: 2026, month: 4, revision: 1, status: "FINALIZED", voidReason: null },
    ),
  );
  assert.equal(long.bytes.subarray(0, 5).toString(), "%PDF-");
  assert.equal(long.pageCount, 1);
});

test("pdf download is limited to staff or the owning employee, and never a draft", () => {
  const finalized = { employeeId, status: "FINALIZED" as const };
  const draft = { employeeId, status: "DRAFT" as const };
  assert.equal(canDownloadPayslip({ role: "ADMIN", employeeId: null }, finalized), true);
  assert.equal(canDownloadPayslip({ role: "SUPER_ADMIN", employeeId: null }, { employeeId, status: "VOID" }), true);
  assert.equal(canDownloadPayslip({ role: "ADMIN", employeeId: null }, draft), false);
  assert.equal(canDownloadPayslip({ role: "USER", employeeId }, finalized), true);
  assert.equal(canDownloadPayslip({ role: "USER", employeeId }, draft), false);
  assert.equal(canDownloadPayslip({ role: "USER", employeeId: otherEmployeeId }, finalized), false);
  assert.equal(canDownloadPayslip({ role: "USER", employeeId: null }, finalized), false);
});
