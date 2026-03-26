/**
 * Noehost Professional Invoice PDF Generator
 * Single-page, unified branded layout — matches the HTML online view.
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
  creditApplied?: number;
  items: InvoiceItem[];
  paymentRef?: string | null;
  paymentNotes?: string | null;
}

// ── Palette (matches HTML view exactly) ──────────────────────────────────────
const BRAND    = "#701AFE";
const PAID_C   = "#16a34a";
const UNPAID_C = "#dc2626";
const GREY     = "#6B7280";
const DARK     = "#1e293b";
const SLATE50  = "#F8FAFC";
const SLATE100 = "#F1F5F9";
const SLATE200 = "#E2E8F0";
const WHITE    = "#FFFFFF";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatPKR(amount: number): string {
  return `Rs. ${Number(amount).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch { return "—"; }
}

function hex(color: string): string {
  return color; // PDFKit accepts hex directly when used as string fill
}

export function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Tighter margins to fit everything on one page
    const doc = new PDFDocument({ size: "A4", margin: 44, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PW = doc.page.width;
    const PH = doc.page.height;
    const L  = 44;          // left margin
    const R  = PW - 44;     // right edge
    const W  = R - L;       // usable width

    const isPaid      = data.status === "paid";
    const isUnpaid    = ["unpaid", "overdue"].includes(data.status);
    const isCancelled = data.status === "cancelled";
    const statusLabel = data.status === "payment_pending" ? "PENDING REVIEW"
      : data.status.replace("_", " ").toUpperCase();
    const statusColor = isPaid ? PAID_C : isCancelled ? GREY : UNPAID_C;

    const creditApplied     = data.creditApplied ?? 0;
    const amountAfterCredit = Number(data.total) - creditApplied;

    // ── HEADER BAND ────────────────────────────────────────────────────────────
    doc.rect(0, 0, PW, 96).fill(BRAND);

    // Logo: "N" bold + "oehost" regular
    doc.font("Helvetica-Bold").fontSize(20).fillColor(WHITE);
    doc.text("N", L, 26, { continued: true });
    doc.font("Helvetica").text("oehost");

    doc.font("Helvetica").fontSize(8).fillColor("rgba(255,255,255,0.62)");
    doc.text("Professional Hosting Solutions", L, 53);
    doc.text("billing@noehost.com", L, 65);

    // INVOICE label (right side)
    doc.font("Helvetica").fontSize(8).fillColor("rgba(255,255,255,0.58)");
    doc.text("INVOICE", 0, 26, { width: PW - 44, align: "right" });
    doc.font("Helvetica-Bold").fontSize(24).fillColor(WHITE);
    doc.text(`#${data.invoiceNumber}`, 0, 38, { width: PW - 44, align: "right" });

    // Status badge — small elegant pill in top-right corner
    const badgeW = 90;
    doc.roundedRect(R - badgeW, 68, badgeW, 18, 4).fill(statusColor);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(WHITE);
    doc.text(statusLabel, R - badgeW, 75, { width: badgeW, align: "center" });

    let y = 108;

    // ── DATE ROW ───────────────────────────────────────────────────────────────
    doc.rect(L, y, W, 34).fill(SLATE100);
    const dateCols = [
      { label: "Invoice Date", value: fmtDate(data.createdAt) },
      { label: "Due Date",     value: fmtDate(data.dueDate)   },
      { label: "Paid Date",    value: isPaid ? fmtDate(data.paidDate) : "—" },
    ];
    const colW = W / 3;
    dateCols.forEach((col, i) => {
      const cx = L + i * colW;
      doc.font("Helvetica").fontSize(6.5).fillColor(GREY);
      doc.text(col.label.toUpperCase(), cx + 6, y + 6, { width: colW - 12, align: "center" });
      doc.font("Helvetica-Bold").fontSize(9).fillColor(DARK);
      doc.text(col.value, cx + 6, y + 16, { width: colW - 12, align: "center" });
      if (i < 2) doc.rect(cx + colW - 0.5, y + 4, 0.5, 26).fill(SLATE200);
    });
    y += 34 + 14;

    // ── BILL FROM / BILL TO ────────────────────────────────────────────────────
    const halfW = (W - 16) / 2;
    const billToX = L + halfW + 16;

    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(BRAND);
    doc.text("PAY TO", L, y);
    const payToY = y;
    y += 10;
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(DARK);
    doc.text("Noehost", L, y);
    y += 13;
    doc.font("Helvetica").fontSize(8).fillColor(GREY);
    doc.text("billing@noehost.com", L, y);       y += 10;
    doc.text("support@noehost.com", L, y);       y += 10;
    doc.text("ns1.noehost.com / ns2.noehost.com", L, y);

    // Bill To (right column — starts at same y as Pay To)
    let bty = payToY;
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(BRAND);
    doc.text("BILL TO", billToX, bty);
    bty += 10;
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(DARK);
    doc.text(data.clientName || "Client", billToX, bty);
    bty += 13;
    if (data.clientEmail) {
      doc.font("Helvetica").fontSize(8).fillColor(GREY);
      doc.text(data.clientEmail, billToX, bty);
    }

    // Vertical divider between columns
    doc.rect(L + halfW + 7, payToY, 0.5, 54).fill(SLATE200);

    y += 16;

    // Divider
    doc.rect(L, y, W, 0.5).fill(SLATE200);
    y += 12;

    // ── ITEMS TABLE ────────────────────────────────────────────────────────────
    // Header row
    doc.roundedRect(L, y, W, 22, 3).fill(BRAND);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(WHITE);
    doc.text("DESCRIPTION", L + 8,  y + 7, { width: W * 0.54 });
    doc.text("QTY",         L + W * 0.56, y + 7, { width: W * 0.08, align: "center" });
    doc.text("UNIT PRICE",  L + W * 0.65, y + 7, { width: W * 0.17, align: "right" });
    doc.text("AMOUNT",      L + W * 0.84, y + 7, { width: W * 0.14, align: "right" });
    y += 22;

    const items = data.items && data.items.length > 0
      ? data.items
      : [{ description: "Service", quantity: 1, unitPrice: data.amount, total: data.amount }];

    items.forEach((item, idx) => {
      const rowH  = 20;
      doc.rect(L, y, W, rowH).fill(idx % 2 === 0 ? WHITE : SLATE50);
      doc.font("Helvetica").fontSize(8).fillColor(DARK);
      doc.text(item.description, L + 8, y + 5, { width: W * 0.53, lineBreak: false, ellipsis: true });
      doc.fillColor(GREY);
      doc.text(String(item.quantity), L + W * 0.56, y + 5, { width: W * 0.08, align: "center" });
      doc.fillColor(DARK);
      doc.text(formatPKR(Number(item.unitPrice)), L + W * 0.65, y + 5, { width: W * 0.17, align: "right" });
      doc.font("Helvetica-Bold");
      doc.text(formatPKR(Number(item.total)), L + W * 0.84, y + 5, { width: W * 0.14, align: "right" });
      y += rowH;
    });

    doc.rect(L, y, W, 0.5).fill(SLATE200);
    y += 12;

    // ── TOTALS ─────────────────────────────────────────────────────────────────
    const totalsX = L + W * 0.55;
    const totalsW = W * 0.45;

    const totalsRows: { label: string; value: string; color?: string; bold?: boolean }[] = [
      { label: "Subtotal",       value: formatPKR(data.amount) },
      { label: "Tax / VAT (0%)", value: formatPKR(data.tax || 0) },
    ];
    if (creditApplied > 0) {
      totalsRows.push({ label: "Account Credit Applied", value: `− ${formatPKR(creditApplied)}`, color: PAID_C, bold: true });
    }

    totalsRows.forEach(row => {
      doc.font(row.bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(row.color ?? GREY);
      doc.text(row.label, totalsX, y, { width: totalsW * 0.56 });
      doc.fillColor(row.color ?? DARK);
      doc.text(row.value, totalsX + totalsW * 0.56, y, { width: totalsW * 0.44, align: "right" });
      y += 13;
    });

    // Total Due band
    doc.roundedRect(totalsX - 6, y - 1, totalsW + 12, 28, 3).fill(BRAND);
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(WHITE);
    doc.text("TOTAL DUE", totalsX, y + 7, { width: totalsW * 0.56 });
    doc.text(
      formatPKR(creditApplied > 0 ? amountAfterCredit : data.total),
      totalsX + totalsW * 0.56, y + 7, { width: totalsW * 0.44, align: "right" }
    );
    y += 36;

    // Payment reference
    if (data.paymentRef) {
      doc.font("Helvetica").fontSize(7.5).fillColor(GREY);
      doc.text(`Payment Reference: ${data.paymentRef}`, L, y);
      y += 10;
      if (data.paymentNotes) {
        doc.text(`Notes: ${data.paymentNotes}`, L, y);
        y += 10;
      }
    }

    y += 6;

    // ── CEO SIGNATURE ───────────────────────────────────────────────────────────
    doc.rect(L, y, W, 0.5).fill(SLATE200);
    y += 10;

    // Light grey executive box
    const sigBoxH = 52;
    doc.roundedRect(L, y, W * 0.65, sigBoxH, 4).fill(SLATE100);
    doc.roundedRect(L, y, W * 0.65, sigBoxH, 4).stroke(SLATE200);

    // Box label
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(GREY);
    doc.text("AUTHORIZED & ISSUED BY", L + 10, y + 8, { width: W * 0.65 - 20 });

    // CEO name in brand color
    doc.font("Helvetica-Bold").fontSize(13).fillColor(BRAND);
    doc.text("Muhammad Arslan", L + 10, y + 19);

    // Title
    doc.font("Helvetica").fontSize(8).fillColor(DARK);
    doc.text("Founder & CEO, Noehost", L + 10, y + 34);

    // Quote
    doc.font("Helvetica-Oblique").fontSize(7).fillColor(GREY);
    doc.text('"Empowering your digital journey with premium hosting solutions."', L + 10, y + 44, { width: W * 0.62, lineBreak: false, ellipsis: true });

    y += sigBoxH + 12;

    // ── TERMS & CONDITIONS ──────────────────────────────────────────────────────
    doc.rect(L, y, W, 0.5).fill(SLATE200);
    y += 10;

    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(GREY);
    doc.text("TERMS & CONDITIONS", L, y);
    y += 9;

    doc.font("Helvetica").fontSize(7).fillColor(GREY);
    doc.text(
      "All services are governed by Noehost Terms of Service (noehost.com/tos). Invoices must be paid by the due date to avoid service interruption. For any billing queries, contact billing@noehost.com. Thank you for choosing Noehost!",
      L, y, { width: W }
    );
    y += 22;

    // ── FOOTER BAND ─────────────────────────────────────────────────────────────
    const footerH = 58;
    const footerY = PH - footerH;
    doc.rect(0, footerY, PW, footerH).fill(BRAND);

    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(WHITE);
    doc.text("Thank you for choosing Noehost!", 0, footerY + 10, { width: PW, align: "center" });

    doc.font("Helvetica").fontSize(7.5).fillColor("rgba(255,255,255,0.65)");
    doc.text(
      "support@noehost.com  ·  https://noehost.com  ·  ns1.noehost.com / ns2.noehost.com",
      0, footerY + 24, { width: PW, align: "center" }
    );

    doc.font("Helvetica").fontSize(7).fillColor("rgba(255,255,255,0.42)");
    doc.text(
      `Invoice #${data.invoiceNumber} — Generated by Noehost Billing System`,
      0, footerY + 38, { width: PW, align: "center" }
    );

    doc.end();
  });
}
