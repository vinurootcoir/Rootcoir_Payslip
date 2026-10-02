import type { PayslipSnapshot } from "@/server/payroll/snapshot";
import { pdfFilename } from "@/server/payroll/payslip-document";

const defaultSubject = "Payslip for {{payrollMonth}}";
const defaultBody = "Hello {{employeeName}},\n\nYour payslip for {{payrollMonth}} is attached.\n\n{{companyName}}";

export type OutboundMail = {
  to: string;
  subject: string;
  text: string;
  filename: string;
  content: Buffer;
};

export class PermanentMailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentMailError";
  }
}

function fill(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{\s*([A-Za-z0-9]+)\s*\}\}/g, (_match, key: string) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] ?? "" : "",
  );
}

export function renderPayslipEmail(input: {
  subjectTemplate: string;
  bodyTemplate: string;
  companyName: string;
  employeeName: string;
  payrollMonth: string;
  payslipNumber: string;
}): { subject: string; text: string } {
  const tokens = {
    employeeName: input.employeeName.trim(),
    companyName: input.companyName.trim(),
    payrollMonth: input.payrollMonth.trim(),
    payslipNumber: input.payslipNumber.trim(),
  };
  const subject = fill(input.subjectTemplate.trim() || defaultSubject, tokens)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  const text = fill(input.bodyTemplate.trim() || defaultBody, tokens).trim().slice(0, 8000);
  return { subject, text };
}

export function bindDeliveryMail(
  delivery: { recipientEmail: string; payrollRecordId: string },
  snapshot: PayslipSnapshot,
  content: Buffer,
  rendered: { subject: string; text: string },
): OutboundMail {
  const to = delivery.recipientEmail.trim().toLowerCase();
  if (!to || to.includes(",") || to.includes(";")) {
    throw new PermanentMailError("The queued recipient is not a single email address.");
  }
  return {
    to,
    subject: rendered.subject,
    text: rendered.text,
    filename: pdfFilename(snapshot.payslipNumber),
    content,
  };
}

export function toSmtpOptions(from: string, mail: OutboundMail): {
  from: string;
  to: string;
  subject: string;
  text: string;
  attachments: { filename: string; content: Buffer; contentType: "application/pdf" }[];
} {
  return {
    from,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    attachments: [{ filename: mail.filename, content: mail.content, contentType: "application/pdf" }],
  };
}
