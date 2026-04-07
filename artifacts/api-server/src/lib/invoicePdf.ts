import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getPublicHostname } from "./app-url.js";
/**
 * Noehost — Professional Single-Page Invoice PDF
 *
 * Root-cause fix: PDFKit auto-adds pages when doc.y > (PH - margin).
 * Drawing the footer at y≈790 pushed the cursor past maxY=801, causing
 * 3 phantom pages. Fix: margin=0 → maxY=841.89 — nothing we draw
 * ever reaches that, so auto-page-break is permanently disabled.
 *
 * Layout budget (A4 = 595 × 841.89 pt, virtual margin = 40):
 *   Header band      : 0–90
 *   Date row         : 100–130
 *   Bill section     : 140–186
 *   Table            : 195–(195 + items×18)
 *   Totals           : +60 max
 *   CEO signature    : +60
 *   T&C              : +30
 *   Footer band      : 789–841
 * ──────────────────────────────────────────────────────────────────────────
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
  // Multi-currency display
  currencyCode?: string;
  currencySymbol?: string;
  currencyRate?: number;
}

// ── Palette ───────────────────────────────────────────────────────────────────
const BRAND    = "#701AFE";
const PAID_C   = "#16a34a";
const UNPAID_C = "#dc2626";
const GREY     = "#94A3B8";
const DARK_G   = "#475569";
const DARK     = "#1E293B";
const SLATE50  = "#F8FAFC";
const SLATE100 = "#F1F5F9";
const SLATE200 = "#E2E8F0";
const WHITE    = "#FFFFFF";

// ── Formatters ────────────────────────────────────────────────────────────────
// Locale map: each currency uses its native locale for correct thousands/decimal separators
const PDF_LOCALE_MAP: Record<string, { locale: string; position: "before" | "after"; separator?: string }> = {
  PKR: { locale: "en-US",  position: "before", separator: " " },
  USD: { locale: "en-US",  position: "before" },
  GBP: { locale: "en-GB",  position: "before" },
  EUR: { locale: "de-DE",  position: "after",  separator: "\u00A0" },
  AED: { locale: "en-AE",  position: "before", separator: " " },
  AUD: { locale: "en-AU",  position: "before" },
  CAD: { locale: "en-CA",  position: "before" },
  INR: { locale: "en-IN",  position: "before" },
};

function formatInCurrency(amount: number, code: string, symbol: string): string {
  const safe = isNaN(amount) || amount == null ? 0 : amount;
  const cfg  = PDF_LOCALE_MAP[code] ?? { locale: "en-US", position: "before" };
  const formatted = safe.toLocaleString(cfg.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (code === "PKR") return `Rs. ${formatted}`;
  if (cfg.position === "after") return `${formatted}${cfg.separator ?? "\u00A0"}${symbol}`;
  return `${symbol}${cfg.separator ?? ""}${formatted}`;
}

function pkr(n: number): string {
  return formatInCurrency(Number(n), "PKR", "Rs.");
}

function makeFmt(currencyCode?: string, currencySymbol?: string, currencyRate?: number) {
  const code   = currencyCode   || "PKR";
  const symbol = currencySymbol || "Rs.";
  const rate   = Number(currencyRate ?? 1) || 1;
  return function fmt(pkrAmount: number): string {
    const converted = Number(pkrAmount) * rate;
    return formatInCurrency(converted, code, symbol);
  };
}

function dt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return "—"; }
}

// ── Logo loader (falls back to null silently) ─────────────────────────────────
const __filename_pdf = fileURLToPath(import.meta.url);
const __dirname_pdf  = path.dirname(__filename_pdf);
const LOGO_PATH      = path.join(__dirname_pdf, "../../../nexgohost/public/uploads/branding/logo.png");
const LOGO_FALLBACK  = path.join(__dirname_pdf, "../../../nexgohost/public/images/logo-standard-black.png");

function loadLogoBuf(): Buffer | null {
  for (const p of [LOGO_PATH, LOGO_FALLBACK]) {
    try { return fs.readFileSync(p); } catch { /* skip */ }
  }
  return null;
}

// ── Generator ─────────────────────────────────────────────────────────────────
export function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {

    // Single-page enforcement: margin=0 so maxY = 841.89 (never reached with our layout).
    // addPage is patched to a no-op so PDFKit can never auto-break to a second page.
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      bufferPages: false,
      autoFirstPage: true,
      info: {
        Title: `Noehost Invoice #${data.invoiceNumber}`,
        Author: "Noehost Billing System",
        Creator: "Noehost",
      },
    });
    // Block any extra page from being added (defensive — layout stays within 841pt)
    (doc as any).addPage = () => doc;

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Multi-currency formatter — converts PKR amounts to display currency
    const fmt = makeFmt(data.currencyCode, data.currencySymbol, data.currencyRate);
    const currencyLabel = (data.currencyCode && data.currencyCode !== "PKR")
      ? ` (${data.currencyCode})`
      : "";

    // Page geometry
    const PW  = doc.page.width;     // 595.28
    const PH  = doc.page.height;    // 841.89
    const VM  = 40;                 // virtual margin (left/right gutter)
    const L   = VM;
    const R   = PW - VM;
    const W   = R - L;              // 515.28

    // Status helpers
    const isPaid      = data.status === "paid";
    const isCancelled = data.status === "cancelled";
    const statusLabel = data.status === "payment_pending" ? "PENDING"
      : data.status.replace(/_/g, " ").toUpperCase();
    const statusColor = isPaid ? PAID_C : isCancelled ? GREY : UNPAID_C;

    const credit         = Number(data.creditApplied ?? 0);
    const totalAfterCred = Number(data.total) - credit;

    // ── 1. HEADER BAND (0–90) ─────────────────────────────────────────────────
    doc.rect(0, 0, PW, 90).fill(BRAND);
    const host = getPublicHostname();

    // Logo — white pill backdrop so dark-text logo is readable on purple header
    const logoBuf = loadLogoBuf();
    if (logoBuf) {
      try {
        doc.roundedRect(L - 6, 13, 216, 50, 8).fill(WHITE);
        doc.image(logoBuf, L, 20, { height: 36, fit: [200, 36] });
      } catch {
        doc.font("Helvetica-Bold").fontSize(20).fillColor(WHITE);
        doc.text("N", L, 20, { continued: true, lineBreak: false });
        doc.font("Helvetica").fillColor("rgba(255,255,255,0.90)").text("oehost", { lineBreak: false });
      }
      doc.font("Helvetica").fontSize(7).fillColor("rgba(255,255,255,0.55)");
      doc.text(`billing@${host}  ·  ${host}`, L, 68, { lineBreak: false });
    } else {
      doc.font("Helvetica-Bold").fontSize(20).fillColor(WHITE);
      doc.text("N", L, 20, { continued: true, lineBreak: false });
      doc.font("Helvetica").fillColor("rgba(255,255,255,0.90)").text("oehost", { lineBreak: false });

      doc.font("Helvetica").fontSize(7.5).fillColor("rgba(255,255,255,0.65)");
      doc.text("Professional Hosting Solutions", L, 46, { lineBreak: false });
      doc.font("Helvetica").fontSize(7).fillColor("rgba(255,255,255,0.48)");
      doc.text(`billing@${host}  ·  ${host}`, L, 57, { lineBreak: false });
    }

    // Invoice number (right-aligned)
    doc.font("Helvetica").fontSize(7.5).fillColor("rgba(255,255,255,0.52)");
    doc.text("INVOICE", 0, 20, { width: R, align: "right", lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(23).fillColor(WHITE);
    doc.text(`#${data.invoiceNumber}`, 0, 31, { width: R, align: "right", lineBreak: false });

    // Status badge — bold coloured pill, top-right
    const bw = 88;
    doc.roundedRect(R - bw, 63, bw, 18, 4).fill(statusColor);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(WHITE);
    doc.text(statusLabel, R - bw, 69, { width: bw, align: "center", lineBreak: false });

    // ── 2. DATE ROW (100–130) ─────────────────────────────────────────────────
    let y = 100;
    const DR = 30;
    doc.rect(L, y, W, DR).fill(SLATE100);
    const dates = [
      { label: "INVOICE DATE", val: dt(data.createdAt) },
      { label: "DUE DATE",     val: dt(data.dueDate)   },
      { label: "PAID DATE",    val: isPaid ? dt(data.paidDate) : "—" },
    ];
    const cW = W / 3;
    dates.forEach(({ label, val }, i) => {
      const cx = L + i * cW;
      doc.font("Helvetica").fontSize(5.5).fillColor(GREY);
      doc.text(label, cx, y + 5, { width: cW, align: "center", lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(DARK);
      doc.text(val, cx, y + 14, { width: cW, align: "center", lineBreak: false });
      if (i < 2) doc.rect(cx + cW, y + 6, 0.5, 18).fill(SLATE200);
    });

    // ── 3. BILL FROM / BILL TO (140–184) ──────────────────────────────────────
    y = 140;
    const half = (W - 16) / 2;
    const btX  = L + half + 16;

    // PAY TO
    doc.font("Helvetica-Bold").fontSize(6).fillColor(BRAND);
    doc.text("PAY TO", L, y, { lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(DARK);
    doc.text("Noehost", L, y + 9, { lineBreak: false });
    doc.font("Helvetica").fontSize(7.5).fillColor(DARK_G);
    doc.text(`billing@${host}`, L, y + 22, { lineBreak: false });
    doc.text(`support@${host}`, L, y + 31, { lineBreak: false });

    // BILL TO
    doc.font("Helvetica-Bold").fontSize(6).fillColor(BRAND);
    doc.text("BILL TO", btX, y, { lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(DARK);
    doc.text(String(data.clientName || "Client").slice(0, 40), btX, y + 9, { width: half, lineBreak: false, ellipsis: true });
    if (data.clientEmail) {
      doc.font("Helvetica").fontSize(7.5).fillColor(DARK_G);
      doc.text(data.clientEmail, btX, y + 22, { width: half, lineBreak: false, ellipsis: true });
    }

    // Column divider
    doc.rect(L + half + 7, y, 0.5, 44).fill(SLATE200);

    // Separator line
    y = 192;
    doc.rect(L, y, W, 0.5).fill(SLATE200);

    // ── 4. ITEMS TABLE (200 onward) ───────────────────────────────────────────
    y = 200;

    // Table header
    doc.rect(L, y, W, 22).fill(BRAND);
    doc.font("Helvetica-Bold").fontSize(7).fillColor(WHITE);
    doc.text("DESCRIPTION",  L + 8,        y + 7, { width: W * 0.50, lineBreak: false });
    doc.text("QTY",          L + W * 0.52, y + 7, { width: W * 0.08, align: "center", lineBreak: false });
    doc.text(`UNIT PRICE${currencyLabel}`, L + W * 0.61, y + 7, { width: W * 0.20, align: "right",  lineBreak: false });
    doc.text(`AMOUNT${currencyLabel}`,     L + W * 0.83, y + 7, { width: W * 0.16, align: "right",  lineBreak: false });
    y += 22;

    const items = (data.items?.length ? data.items : [{
      description: "Service", quantity: 1,
      unitPrice: Number(data.amount), total: Number(data.amount),
    }]).slice(0, 10); // hard cap at 10 rows

    const ROW = 18;
    items.forEach((item, idx) => {
      // Row background — subtle alternating stripe
      doc.rect(L, y, W, ROW).fill(idx % 2 === 0 ? WHITE : SLATE50);
      // Light bottom border
      doc.rect(L, y + ROW - 0.5, W, 0.5).fill(SLATE200);

      doc.font("Helvetica").fontSize(7.5).fillColor(DARK);
      doc.text(String(item.description), L + 8, y + 5,
        { width: W * 0.49, lineBreak: false, ellipsis: true });

      doc.fillColor(DARK_G);
      doc.text(String(item.quantity), L + W * 0.52, y + 5,
        { width: W * 0.08, align: "center", lineBreak: false });

      doc.fillColor(DARK);
      doc.text(fmt(Number(item.unitPrice)), L + W * 0.61, y + 5,
        { width: W * 0.20, align: "right", lineBreak: false });

      doc.font("Helvetica-Bold").fillColor(DARK);
      doc.text(fmt(Number(item.total)), L + W * 0.83, y + 5,
        { width: W * 0.16, align: "right", lineBreak: false });

      y += ROW;
    });

    // Table bottom border
    doc.rect(L, y, W, 1).fill(SLATE200);
    y += 10;

    // ── 5. TOTALS (right-aligned block) ───────────────────────────────────────
    const tX  = L + W * 0.54;
    const tW  = W * 0.46;
    const lW  = tW * 0.54;
    const vW  = tW * 0.46;
    const ROW_T = 16;

    const totals: { label: string; value: string; green?: boolean; bold?: boolean }[] = [
      { label: "Subtotal",       value: fmt(Number(data.amount)) },
      { label: "Tax / VAT (0%)", value: fmt(Number(data.tax || 0)) },
    ];
    if (credit > 0) {
      totals.push({ label: "Account Credit Applied", value: `− ${fmt(credit)}`, green: true, bold: true });
    }

    // Subtotals block — light grey background
    const subtotalBlockH = totals.length * ROW_T + 8;
    doc.rect(tX - 8, y - 4, tW + 16, subtotalBlockH).fill(SLATE50);

    totals.forEach(row => {
      const fc = row.green ? PAID_C : DARK_G;
      doc.font(row.bold ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(fc);
      doc.text(row.label, tX, y, { width: lW, lineBreak: false });
      doc.fillColor(row.green ? PAID_C : DARK).font(row.bold ? "Helvetica-Bold" : "Helvetica");
      doc.text(row.value, tX + lW, y, { width: vW, align: "right", lineBreak: false });
      y += ROW_T;
    });

    // Separator before total
    y += 2;
    doc.rect(tX - 8, y - 1, tW + 16, 0.75).fill(SLATE200);
    y += 4;

    // Total Due pill — taller, larger text
    doc.rect(tX - 8, y, tW + 16, 30).fill(BRAND);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("rgba(255,255,255,0.70)");
    doc.text("TOTAL DUE", tX, y + 7, { width: lW, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(13).fillColor(WHITE);
    doc.text(fmt(credit > 0 ? totalAfterCred : Number(data.total)),
      tX + lW, y + 5, { width: vW, align: "right", lineBreak: false });
    y += 38;

    // Payment ref (compact, single line)
    if (data.paymentRef) {
      doc.font("Helvetica").fontSize(7).fillColor(GREY);
      const refLine = `Ref: ${data.paymentRef}${data.paymentNotes ? "  |  " + data.paymentNotes : ""}`;
      doc.text(refLine, L, y, { width: W, lineBreak: false, ellipsis: true });
      y += 11;
    }

    y += 6;

    // ── 6. DIVIDER ────────────────────────────────────────────────────────────
    doc.rect(L, y, W, 0.5).fill(SLATE200);
    y += 10;

    // ── 7. CEO SIGNATURE (bottom-right) + TERMS (bottom-left) ────────────────
    // Two-column layout: T&C on left, Signature on right
    const sigW  = W * 0.50;
    const termsW = W * 0.46;
    const sigX  = R - sigW;

    // Signature box (right)
    const sigH = 52;
    doc.rect(sigX, y, sigW, sigH).fill(SLATE100);

    doc.font("Helvetica-Bold").fontSize(5.5).fillColor(GREY);
    doc.text("AUTHORIZED & ISSUED BY", sigX + 8, y + 6,
      { width: sigW - 16, lineBreak: false });

    doc.font("Helvetica-Bold").fontSize(13).fillColor(BRAND);
    doc.text("Muhammad Arslan", sigX + 8, y + 16, { lineBreak: false });

    doc.font("Helvetica").fontSize(8).fillColor(DARK);
    doc.text("Founder & CEO, Noehost", sigX + 8, y + 31, { lineBreak: false });

    doc.font("Helvetica-Oblique").fontSize(6.5).fillColor(GREY);
    doc.text(
      "\u201CEmpowering your digital journey with premium hosting solutions.\u201D",
      sigX + 8, y + 42,
      { width: sigW - 16, lineBreak: false, ellipsis: true }
    );

    // T&C text (left of signature box)
    doc.font("Helvetica-Bold").fontSize(6).fillColor(DARK_G);
    doc.text("TERMS & CONDITIONS", L, y + 6, { width: termsW, lineBreak: false });

    doc.font("Helvetica").fontSize(6.5).fillColor(GREY);
    doc.text(
      `All services are governed by Terms of Service (${host}/tos). `
      + "Invoices must be paid by the due date to avoid service interruption. "
      + `For billing queries, contact billing@${host}.`,
      L, y + 16,
      { width: termsW, lineBreak: false, ellipsis: true }
    );

    // ── 8. FOOTER BAND (PH-52 to PH) — drawn LAST so cursor reset is harmless
    const FY = PH - 52;
    doc.rect(0, FY, PW, 52).fill(BRAND);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(WHITE);
    doc.text("Thank you for choosing Noehost!",
      0, FY + 10, { width: PW, align: "center", lineBreak: false });
    doc.font("Helvetica").fontSize(7).fillColor("rgba(255,255,255,0.58)");
    doc.text(`support@${host}  ·  ${host}  ·  billing@${host}`,
      0, FY + 24, { width: PW, align: "center", lineBreak: false });
    doc.font("Helvetica").fontSize(6.5).fillColor("rgba(255,255,255,0.35)");
    doc.text(
      `Invoice #${data.invoiceNumber} \u2014 Generated by Noehost Billing System`,
      0, FY + 37, { width: PW, align: "center", lineBreak: false }
    );

    doc.end();
  });
}
