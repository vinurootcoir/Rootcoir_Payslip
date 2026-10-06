import { readFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { PayslipDocument } from "./payslip-document";

const regularFont = path.join(process.cwd(), "assets", "fonts", "Inter-Regular.otf");
const boldFont = path.join(process.cwd(), "assets", "fonts", "Inter-Bold.otf");
const templatePath = path.join(process.cwd(), "public", "template", "template.png");
const templateWidth = 1414;
const templateHeight = 2000;

let templateBytes: Buffer | null = null;

function templateImage(): Buffer {
  if (!templateBytes) templateBytes = readFileSync(templatePath);
  return templateBytes;
}

function sx(doc: PDFKit.PDFDocument, px: number): number {
  return (px / templateWidth) * doc.page.width;
}

function sy(doc: PDFKit.PDFDocument, py: number): number {
  return (py / templateHeight) * doc.page.height;
}

function cell(
  doc: PDFKit.PDFDocument,
  value: string,
  box: { x: number; y: number; w: number; h: number },
  options: { align?: "left" | "right"; size?: number; bold?: boolean; color?: string } = {},
): void {
  if (!value) return;
  const size = options.size ?? 9;
  const top = sy(doc, box.y) + Math.max(0, (sy(doc, box.h) - size) / 2 - 1);
  doc.font(options.bold ? "Inter-Bold" : "Inter").fontSize(size).fillColor(options.color ?? "#2c201c");
  doc.text(value, sx(doc, box.x), top, {
    width: sx(doc, box.w),
    height: size + 3,
    align: options.align ?? "left",
    lineBreak: false,
    ellipsis: true,
  });
}

function fillRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, color: string): void {
  doc.save();
  doc.rect(sx(doc, x), sy(doc, y), sx(doc, w), sy(doc, h)).fill(color);
  doc.restore();
}

function draw(doc: PDFKit.PDFDocument, document: PayslipDocument): void {
  doc.image(templateImage(), 0, 0, { width: doc.page.width, height: doc.page.height });
  const slip = document.slip;
  const leftValue = { x: 314, w: 380, h: 60 };
  const rightValue = { x: 946, w: 380, h: 60 };
  const identity = [
    { y: 421, left: slip.employeeName, right: slip.employeeNumber },
    { y: 482, left: slip.designation, right: slip.department },
    { y: 542, left: slip.payPeriod, right: slip.paidDays },
    { y: 602, left: slip.lopDays, right: slip.paymentStatus },
  ];
  for (const row of identity) {
    cell(doc, row.left, { ...leftValue, y: row.y });
    cell(doc, row.right, { ...rightValue, y: row.y });
  }
  cell(doc, slip.salaryMonth, { x: 704, y: 308, w: 420, h: 28 }, { size: 9 });

  const earnAmount = { x: 510, w: 168, h: 51 };
  const deductAmount = { x: 1144, w: 168, h: 51 };
  const moneyRows = [
    { y: 803, earn: slip.basic, deduct: slip.epf },
    { y: 855, earn: slip.hra, deduct: slip.esi },
    { y: 907, earn: slip.conveyance, deduct: slip.professionalTax },
    { y: 959, earn: slip.special, deduct: slip.otherDeductions },
    { y: 1012, earn: slip.gross, deduct: slip.totalDeductions },
  ];
  for (const row of moneyRows) {
    const bold = row.y === 1012;
    cell(doc, row.earn, { ...earnAmount, y: row.y }, { align: "right", bold });
    cell(doc, row.deduct, { ...deductAmount, y: row.y }, { align: "right", bold });
  }

  cell(doc, slip.net, { x: 1172, y: 1112, w: 155, h: 68 }, { align: "right", size: 11, bold: true, color: "#ffffff" });

  fillRect(doc, 70, 1190, 1270, 52, "#ffffff");
  doc.font("Inter").fontSize(8).fillColor("#2c201c");
  doc.text(`Amount in words: ${slip.amountInWords}`, sx(doc, 91), sy(doc, 1206), {
    width: sx(doc, 1240),
    height: sy(doc, 36),
  });

  if (slip.voidNote) {
    doc.font("Inter").fontSize(8).fillColor("#a93a3a");
    doc.text(slip.voidNote, sx(doc, 91), sy(doc, 1472), { width: sx(doc, 1220) });
  }
}

export function renderPayslipPdf(document: PayslipDocument): Promise<{ bytes: Buffer; pageCount: number }> {
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
  doc.registerFont("Inter", regularFont);
  doc.registerFont("Inter-Bold", boldFont);
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => {
      resolve({ bytes: Buffer.concat(chunks), pageCount });
    });
    draw(doc, document);
    const pageCount = doc.bufferedPageRange().count;
    doc.end();
  });
}
