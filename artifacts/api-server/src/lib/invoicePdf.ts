/**
 * Noehost Professional Invoice PDF Generator
 * Uses pdfkit to produce WHMCS-style A4 invoices with Noehost branding.
 */
import PDFDocument from "pdfkit";

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  status: string;
  createdAt: string;
  dueDate: string;
  paidDate?: string | null;
  clientName: string;
  clientEmail?: string;
  amount: number;
  tax: number;
  total: number;
  items: InvoiceItem[];
  paymentRef?: string | null;
  paymentNotes?: string | null;
}

const BRAND   = "#701AFE";
const PAID_C  = "#16a34a";
const UNPAID_C = "#dc2626";
const GREY    = "#6B7280";
const DARK    = "#111827";
const LIGHT   = "#F9FAFB";
const MID     = "#E5E7EB";

function formatPKR(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });
  } catch { return "—"; }
}

export function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 100; // usable width (margins 50 each side)
    const L = 50;                    // left margin

    // ── HEADER BAND ──────────────────────────────────────────────────────────
    // Background rectangle
    doc.rect(0, 0, doc.page.width, 110).fill(BRAND);

    // Noehost logo text
    doc.font("Helvetica-Bold").fontSize(26).fillColor("#FFFFFF");
    doc.text("N", L, 28, { continued: true })
       .font("Helvetica").text("oehost", { continued: false });

    doc.font("Helvetica").fontSize(9).fillColor("rgba(255,255,255,0.75)");
    doc.text("Professional Hosting Solutions", L, 58);
    doc.text("billing@noehost.com  ·  ns1.noehost.com  ·  ns2.noehost.com", L, 72);

    // INVOICE label (right side)
    doc.font("Helvetica-Bold").fontSize(30).fillColor("#FFFFFF");
    doc.text("INVOICE", 0, 26, { width: doc.page.width - 50, align: "right" });

    doc.font("Helvetica").fontSize(12).fillColor("rgba(255,255,255,0.85)");
    doc.text(`#${data.invoiceNumber}`, 0, 62, { width: doc.page.width - 50, align: "right" });

    // ── STATUS BADGE ─────────────────────────────────────────────────────────
    const isPaid = data.status === "paid";
    const statusColor = isPaid ? PAID_C : data.status === "cancelled" ? GREY : UNPAID_C;
    const statusLabel = data.status.replace("_", " ").toUpperCase();
    doc.roundedRect(doc.page.width - 140, 80, 90, 22, 5).fill(statusColor);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#FFFFFF");
    doc.text(statusLabel, doc.page.width - 140, 87, { width: 90, align: "center" });

    let y = 130;

    // ── DATE ROW ─────────────────────────────────────────────────────────────
    doc.rect(L, y, W, 34).fill(LIGHT);
    const dateCols = [
      { label: "Invoice Date", value: fmtDate(data.createdAt) },
      { label: "Due Date",     value: fmtDate(data.dueDate)   },
      { label: "Paid Date",    value: isPaid ? fmtDate(data.paidDate) : "—" },
    ];
    const colW = W / 3;
    dateCols.forEach((col, i) => {
      const cx = L + i * colW;
      doc.font("Helvetica").fontSize(7.5).fillColor(GREY);
      doc.text(col.label.toUpperCase(), cx + 8, y + 6, { width: colW - 16 });
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(DARK);
      doc.text(col.value, cx + 8, y + 17, { width: colW - 16 });
      if (i < 2) {
        doc.rect(cx + colW, y + 4, 0.5, 26).fill(MID);
      }
    });
    y += 34 + 16;

    // ── BILL FROM / BILL TO ───────────────────────────────────────────────────
    const halfW = (W - 20) / 2;

    // Bill From
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(BRAND);
    doc.text("PAY TO", L, y);
    y += 12;
    doc.font("Helvetica-Bold").fontSize(11).fillColor(DARK);
    doc.text("Noehost", L, y);
    y += 14;
    doc.font("Helvetica").fontSize(9).fillColor(GREY);
    doc.text("billing@noehost.com", L, y);   y += 12;
    doc.text("support@noehost.com", L, y);   y += 12;
    doc.text("ns1.noehost.com / ns2.noehost.com", L, y);

    // Bill To (right column)
    let ryStart = y - 38;
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(BRAND);
    doc.text("BILL TO", L + halfW + 20, ryStart);
    ryStart += 12;
    doc.font("Helvetica-Bold").fontSize(11).fillColor(DARK);
    doc.text(data.clientName || "Client", L + halfW + 20, ryStart);
    ryStart += 14;
    if (data.clientEmail) {
      doc.font("Helvetica").fontSize(9).fillColor(GREY);
      doc.text(data.clientEmail, L + halfW + 20, ryStart);
    }

    y += 26;

    // Divider
    doc.rect(L, y, W, 1).fill(MID);
    y += 16;

    // ── ITEMS TABLE ───────────────────────────────────────────────────────────
    // Header row
    doc.rect(L, y, W, 24).fill(BRAND);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#FFFFFF");
    doc.text("DESCRIPTION", L + 10, y + 7, { width: W * 0.55 });
    doc.text("TAX/VAT", L + W * 0.57, y + 7, { width: W * 0.15, align: "right" });
    doc.text("UNIT PRICE", L + W * 0.73, y + 7, { width: W * 0.12, align: "right" });
    doc.text("AMOUNT", L + W * 0.87, y + 7, { width: W * 0.11, align: "right" });
    y += 24;

    const items = data.items && data.items.length > 0
      ? data.items
      : [{ description: "Service", quantity: 1, unitPrice: data.amount, total: data.amount }];

    items.forEach((item, idx) => {
      const rowBg = idx % 2 === 0 ? "#FFFFFF" : LIGHT;
      const rowH = 22;
      doc.rect(L, y, W, rowH).fill(rowBg);
      doc.font("Helvetica").fontSize(8.5).fillColor(DARK);
      doc.text(item.description, L + 10, y + 6, { width: W * 0.54, lineBreak: false, ellipsis: true });
      doc.fillColor(GREY);
      doc.text("0%", L + W * 0.57, y + 6, { width: W * 0.15, align: "right" });
      doc.fillColor(DARK);
      doc.text(formatPKR(Number(item.unitPrice)), L + W * 0.73, y + 6, { width: W * 0.12, align: "right" });
      doc.font("Helvetica-Bold");
      doc.text(formatPKR(Number(item.total)), L + W * 0.87, y + 6, { width: W * 0.11, align: "right" });
      y += rowH;
    });

    // Table bottom border
    doc.rect(L, y, W, 1).fill(MID);
    y += 16;

    // ── TOTALS ────────────────────────────────────────────────────────────────
    const totalsX = L + W * 0.57;
    const totalsW = W * 0.43;

    const totals = [
      { label: "Subtotal", value: formatPKR(data.amount) },
      { label: "Tax / VAT (0%)", value: formatPKR(data.tax || 0) },
    ];

    totals.forEach(row => {
      doc.font("Helvetica").fontSize(9).fillColor(GREY);
      doc.text(row.label, totalsX, y, { width: totalsW * 0.55 });
      doc.font("Helvetica").fillColor(DARK);
      doc.text(row.value, totalsX + totalsW * 0.55, y, { width: totalsW * 0.45, align: "right" });
      y += 14;
    });

    // Total due row
    doc.rect(totalsX - 8, y - 4, totalsW + 16, 30).fill(BRAND);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#FFFFFF");
    doc.text("TOTAL DUE", totalsX, y + 8, { width: totalsW * 0.55 });
    doc.text(formatPKR(data.total), totalsX + totalsW * 0.55, y + 8, { width: totalsW * 0.45, align: "right" });
    y += 42;

    // Payment reference (if any)
    if (data.paymentRef) {
      doc.font("Helvetica").fontSize(8).fillColor(GREY);
      doc.text(`Payment Reference: ${data.paymentRef}`, L, y);
      y += 11;
      if (data.paymentNotes) {
        doc.text(`Notes: ${data.paymentNotes}`, L, y);
        y += 11;
      }
    }

    y += 10;

    // ── PAID / UNPAID WATERMARK ───────────────────────────────────────────────
    doc.save();
    doc.opacity(0.07);
    doc.font("Helvetica-Bold").fontSize(90).fillColor(isPaid ? PAID_C : UNPAID_C);
    doc.rotate(isPaid ? -30 : -30, { origin: [doc.page.width / 2, doc.page.height / 2] });
    doc.text(isPaid ? "PAID" : "UNPAID", 30, doc.page.height / 2 - 60, { width: doc.page.width - 60, align: "center" });
    doc.restore();

    // ── FOOTER ────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 75;
    doc.rect(0, footerY - 10, doc.page.width, 85).fill(BRAND);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#FFFFFF");
    doc.text("Thank you for choosing Noehost!", 0, footerY + 2, { width: doc.page.width, align: "center" });
    doc.font("Helvetica").fontSize(8).fillColor("rgba(255,255,255,0.75)");
    doc.text("support@noehost.com  ·  https://noehost.com  ·  ns1.noehost.com / ns2.noehost.com", 0, footerY + 16, { width: doc.page.width, align: "center" });
    doc.font("Helvetica").fontSize(7.5).fillColor("rgba(255,255,255,0.55)");
    doc.text(`Invoice #${data.invoiceNumber} — Generated by Noehost Billing System`, 0, footerY + 31, { width: doc.page.width, align: "center" });

    doc.end();
  });
}
