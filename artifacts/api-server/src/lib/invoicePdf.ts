/**
 * Noehost Professional Invoice PDF Generator
 * Designed to match the HTML online view — unified branded layout.
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
  creditApplied?: number;   // Account credit deducted from total
  items: InvoiceItem[];
  paymentRef?: string | null;
  paymentNotes?: string | null;
}

// ── Palette (matches HTML view) ───────────────────────────────────────────────
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
  return `Rs. ${Number(amount).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch { return "—"; }
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

export function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W  = doc.page.width - 100;   // usable width (50px margin each side)
    const L  = 50;                      // left margin
    const PW = doc.page.width;

    const isPaid     = data.status === "paid";
    const isUnpaid   = ["unpaid", "overdue"].includes(data.status);
    const isCancelled = data.status === "cancelled";

    const statusLabel = data.status === "payment_pending" ? "PENDING REVIEW"
      : data.status.replace("_", " ").toUpperCase();
    const statusColor = isPaid ? PAID_C : isCancelled ? GREY : UNPAID_C;

    // Credit deduction
    const creditApplied   = data.creditApplied ?? 0;
    const amountAfterCredit = Number(data.total) - creditApplied;

    // ── HEADER BAND ────────────────────────────────────────────────────────────
    const [br, bg, bb] = hexToRgb(BRAND);
    doc.rect(0, 0, PW, 105).fill(`rgb(${br},${bg},${bb})`);

    // Logo
    doc.font("Helvetica-Bold").fontSize(22).fillColor(WHITE);
    doc.text("N", L, 30, { continued: true });
    doc.font("Helvetica").text("oehost");

    doc.font("Helvetica").fontSize(8.5).fillColor("rgba(255,255,255,0.68)");
    doc.text("Professional Hosting Solutions", L, 57);
    doc.text("billing@noehost.com  ·  ns1.noehost.com  ·  ns2.noehost.com", L, 69);

    // INVOICE label (right)
    doc.font("Helvetica").fontSize(9).fillColor("rgba(255,255,255,0.65)");
    doc.text("INVOICE", 0, 30, { width: PW - 50, align: "right" });
    doc.font("Helvetica-Bold").fontSize(26).fillColor(WHITE);
    doc.text(`#${data.invoiceNumber}`, 0, 42, { width: PW - 50, align: "right" });

    // Status badge
    const [sr, sg, sb] = hexToRgb(statusColor);
    doc.roundedRect(PW - 148, 76, 98, 20, 4).fill(`rgb(${sr},${sg},${sb})`);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(WHITE);
    doc.text(statusLabel, PW - 148, 83, { width: 98, align: "center" });

    let y = 120;

    // ── DATE ROW ───────────────────────────────────────────────────────────────
    doc.rect(L, y, W, 38).fill(SLATE100);
    const dateCols = [
      { label: "Invoice Date", value: fmtDate(data.createdAt) },
      { label: "Due Date",     value: fmtDate(data.dueDate) },
      { label: "Paid Date",    value: isPaid ? fmtDate(data.paidDate) : "—" },
    ];
    const colW = W / 3;
    dateCols.forEach((col, i) => {
      const cx = L + i * colW;
      doc.font("Helvetica").fontSize(7).fillColor(GREY);
      doc.text(col.label.toUpperCase(), cx + 8, y + 7, { width: colW - 16, align: "center" });
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(DARK);
      doc.text(col.value, cx + 8, y + 18, { width: colW - 16, align: "center" });
      if (i < 2) {
        doc.rect(cx + colW - 0.5, y + 5, 0.5, 28).fill(SLATE200);
      }
    });
    y += 38 + 18;

    // ── BILL FROM / BILL TO ────────────────────────────────────────────────────
    const halfW = (W - 20) / 2;

    // Pay To column
    doc.font("Helvetica-Bold").fontSize(7).fillColor(BRAND);
    doc.text("PAY TO", L, y);
    y += 12;
    doc.font("Helvetica-Bold").fontSize(11).fillColor(DARK);
    doc.text("Noehost", L, y);
    y += 14;
    doc.font("Helvetica").fontSize(8.5).fillColor(GREY);
    doc.text("billing@noehost.com", L, y);       y += 11;
    doc.text("support@noehost.com", L, y);       y += 11;
    doc.text("ns1.noehost.com / ns2.noehost.com", L, y);

    // Bill To column (right)
    const billToX = L + halfW + 20;
    let ryStart = y - 36;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(BRAND);
    doc.text("BILL TO", billToX, ryStart);
    ryStart += 12;
    doc.font("Helvetica-Bold").fontSize(11).fillColor(DARK);
    doc.text(data.clientName || "Client", billToX, ryStart);
    ryStart += 14;
    if (data.clientEmail) {
      doc.font("Helvetica").fontSize(8.5).fillColor(GREY);
      doc.text(data.clientEmail, billToX, ryStart);
    }

    // Vertical divider between columns
    doc.rect(L + halfW + 10, y - 48, 0.5, 60).fill(SLATE200);

    y += 28;

    // Divider
    doc.rect(L, y, W, 0.5).fill(SLATE200);
    y += 16;

    // ── LINE ITEMS TABLE ───────────────────────────────────────────────────────
    // Header
    doc.roundedRect(L, y, W, 24, 3).fill(BRAND);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(WHITE);
    doc.text("DESCRIPTION", L + 10, y + 8, { width: W * 0.54 });
    doc.text("QTY",         L + W * 0.56, y + 8, { width: W * 0.08, align: "center" });
    doc.text("UNIT PRICE",  L + W * 0.65, y + 8, { width: W * 0.17, align: "right" });
    doc.text("AMOUNT",      L + W * 0.84, y + 8, { width: W * 0.14, align: "right" });
    y += 24;

    const items = data.items && data.items.length > 0
      ? data.items
      : [{ description: "Service", quantity: 1, unitPrice: data.amount, total: data.amount }];

    items.forEach((item, idx) => {
      const rowBg = idx % 2 === 0 ? WHITE : SLATE50;
      const rowH  = 22;
      doc.rect(L, y, W, rowH).fill(rowBg);
      doc.font("Helvetica").fontSize(8.5).fillColor(DARK);
      doc.text(item.description, L + 10, y + 6, { width: W * 0.53, lineBreak: false, ellipsis: true });
      doc.fillColor(GREY);
      doc.text(String(item.quantity), L + W * 0.56, y + 6, { width: W * 0.08, align: "center" });
      doc.fillColor(DARK);
      doc.text(formatPKR(Number(item.unitPrice)), L + W * 0.65, y + 6, { width: W * 0.17, align: "right" });
      doc.font("Helvetica-Bold");
      doc.text(formatPKR(Number(item.total)), L + W * 0.84, y + 6, { width: W * 0.14, align: "right" });
      y += rowH;
    });

    doc.rect(L, y, W, 0.5).fill(SLATE200);
    y += 16;

    // ── TOTALS ─────────────────────────────────────────────────────────────────
    const totalsX = L + W * 0.55;
    const totalsW = W * 0.45;

    // Subtotal
    doc.font("Helvetica").fontSize(9).fillColor(GREY);
    doc.text("Subtotal", totalsX, y, { width: totalsW * 0.55 });
    doc.fillColor(DARK);
    doc.text(formatPKR(data.amount), totalsX + totalsW * 0.55, y, { width: totalsW * 0.45, align: "right" });
    y += 14;

    // Tax
    doc.font("Helvetica").fontSize(9).fillColor(GREY);
    doc.text("Tax / VAT (0%)", totalsX, y, { width: totalsW * 0.55 });
    doc.fillColor(DARK);
    doc.text(formatPKR(data.tax || 0), totalsX + totalsW * 0.55, y, { width: totalsW * 0.45, align: "right" });
    y += 14;

    // Credit deduction (if applicable)
    if (creditApplied > 0) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#16a34a");
      doc.text("Account Credit Applied", totalsX, y, { width: totalsW * 0.55 });
      doc.text(`− ${formatPKR(creditApplied)}`, totalsX + totalsW * 0.55, y, { width: totalsW * 0.45, align: "right" });
      y += 14;
    }

    // Total Due row
    doc.roundedRect(totalsX - 8, y - 2, totalsW + 16, 30, 4).fill(BRAND);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(WHITE);
    doc.text("TOTAL DUE", totalsX, y + 8, { width: totalsW * 0.55 });
    doc.text(formatPKR(creditApplied > 0 ? amountAfterCredit : data.total), totalsX + totalsW * 0.55, y + 8, { width: totalsW * 0.45, align: "right" });
    y += 40;

    // Payment reference
    if (data.paymentRef) {
      doc.font("Helvetica").fontSize(8).fillColor(GREY);
      doc.text(`Payment Reference: ${data.paymentRef}`, L, y);
      y += 11;
      if (data.paymentNotes) {
        doc.text(`Notes: ${data.paymentNotes}`, L, y);
        y += 11;
      }
    }

    y += 8;

    // ── UNPAID WATERMARK (only for unpaid / overdue) ────────────────────────────
    if (isUnpaid) {
      doc.save();
      doc.opacity(0.07);
      doc.font("Helvetica-Bold").fontSize(80).fillColor(UNPAID_C);
      doc.rotate(-35, { origin: [PW / 2, doc.page.height / 2] });
      // Draw border box outline + text
      doc.text("UNPAID", 40, doc.page.height / 2 - 50, { width: PW - 80, align: "center" });
      doc.restore();
    }

    // ── FOOTER ──────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 72;
    doc.rect(0, footerY, PW, 72).fill(BRAND);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(WHITE);
    doc.text("Thank you for choosing Noehost!", 0, footerY + 12, { width: PW, align: "center" });
    doc.font("Helvetica").fontSize(8).fillColor("rgba(255,255,255,0.65)");
    doc.text("support@noehost.com  ·  https://noehost.com  ·  ns1.noehost.com / ns2.noehost.com", 0, footerY + 26, { width: PW, align: "center" });
    doc.font("Helvetica").fontSize(7.5).fillColor("rgba(255,255,255,0.42)");
    doc.text(`Invoice #${data.invoiceNumber} — Generated by Noehost Billing System`, 0, footerY + 42, { width: PW, align: "center" });

    doc.end();
  });
}
