import { existsSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { PayslipDocument, PayslipRow } from "./payslip-document";

const margin = 40;
const ink = "#2c201c";
const muted = "#71594f";
const accent = "#6e2140";
const line = "#e2d2b8";
const plate = "#fffbf3";

const regularFont = path.join(process.cwd(), "assets", "fonts", "Inter-Regular.otf");
const boldFont = path.join(process.cwd(), "assets", "fonts", "Inter-Bold.otf");
const logoPath = path.join(process.cwd(), "public", "rootcoir.png");

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - margin * 2;
}

function ensure(doc: PDFKit.PDFDocument, height: number, document: PayslipDocument): void {
  if (doc.y + height <= doc.page.height - margin) return;
  doc.addPage();
  doc.font("Inter").fontSize(9).fillColor(accent);
  doc.text(`${document.payslipNumber} · ${document.employeeName}`, margin, margin, {
    width: contentWidth(doc),
  });
  doc.moveDown(0.6);
}

function writeParagraph(doc: PDFKit.PDFDocument, document: PayslipDocument, text: string, size: number, color: string): void {
  doc.font("Inter").fontSize(size);
  const height = doc.heightOfString(text, { width: contentWidth(doc) });
  ensure(doc, height, document);
  doc.fillColor(color).text(text, margin, doc.y, { width: contentWidth(doc) });
}

function drawRows(doc: PDFKit.PDFDocument, document: PayslipDocument, rows: PayslipRow[]): void {
  const width = contentWidth(doc);
  for (const entry of rows) {
    doc.font("Inter").fontSize(10);
    const valueWidth = width - 190;
    const stacked = doc.heightOfString(entry.value, { width: valueWidth }) > 28;
    if (stacked) {
      const blockHeight =
        doc.heightOfString(entry.label, { width }) + doc.heightOfString(entry.value, { width }) + 8;
      ensure(doc, blockHeight, document);
      doc.fillColor(muted).text(entry.label, margin, doc.y, { width });
      doc.font("Inter").fillColor(ink).text(entry.value, margin, doc.y, { width });
      doc.moveDown(0.3);
      continue;
    }
    const rowHeight = Math.max(
      doc.heightOfString(entry.label, { width: 180 }),
      doc.heightOfString(entry.value, { width: valueWidth }),
    );
    ensure(doc, rowHeight + 4, document);
    const top = doc.y;
    doc.fillColor(muted).text(entry.label, margin, top, { width: 180 });
    doc.fillColor(ink).text(entry.value, margin + 190, top, { width: valueWidth, align: "right" });
    doc.y = top + rowHeight + 4;
  }
}

function draw(doc: PDFKit.PDFDocument, document: PayslipDocument): void {
  doc.font("Inter");
  if (existsSync(logoPath)) {
    doc.save();
    doc.roundedRect(margin, margin, 168, 42, 6).fill(plate);
    doc.restore();
    doc.image(logoPath, margin + 6, margin + 8, { fit: [156, 26] });
    doc.y = margin + 52;
  } else {
    doc.y = margin;
  }

  if (document.companyName) {
    doc.font("Inter-Bold").fontSize(16).fillColor(ink);
    doc.text(document.companyName, margin, doc.y, { width: contentWidth(doc) });
  }
  for (const paragraph of document.companyAddress) {
    writeParagraph(doc, document, paragraph, 10, muted);
  }
  doc.moveDown(0.4);
  doc.moveTo(margin, doc.y).lineTo(margin + contentWidth(doc), doc.y).strokeColor(line).stroke();
  doc.moveDown(0.6);
  doc.font("Inter-Bold").fontSize(13).fillColor(accent).text("Payslip", margin, doc.y, { width: contentWidth(doc) });
  if (document.notice) {
    doc.moveDown(0.3);
    writeParagraph(doc, document, document.notice, 10, "#a93a3a");
  }
  doc.moveDown(0.6);

  for (const block of document.blocks) {
    doc.font("Inter-Bold").fontSize(11);
    ensure(doc, 18, document);
    doc.fillColor(accent).text(block.title, margin, doc.y, { width: contentWidth(doc) });
    doc.moveDown(0.3);
    if (block.kind === "rows") drawRows(doc, document, block.rows);
    else {
      for (const paragraph of block.paragraphs) writeParagraph(doc, document, paragraph, 10, ink);
    }
    doc.moveDown(0.5);
  }
  doc.moveDown(0.2);
  writeParagraph(doc, document, document.disclaimer, 8, muted);
}

export function renderPayslipPdf(document: PayslipDocument): Promise<{ bytes: Buffer; pageCount: number }> {
  const doc = new PDFDocument({ size: "A4", margin, bufferPages: true });
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
