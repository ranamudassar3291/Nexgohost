/**
 * Spaceship Domain Registrar — Native TypeScript Integration
 * API Docs: https://developer.spaceship.com/api-reference
 *
 * Implements: Register, Renew, Transfer, Update Nameservers,
 *             Get EPP/Auth Code, Lock/Unlock, Live TLD Prices,
 *             Account Balance, and Loss-Prevention Kill Switch.
 */

import { db } from "@workspace/db";
import { currenciesTable, settingsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sendWhatsAppAlert } from "./whatsapp.js";

const SPACESHIP_BASE = "https://api.spaceship.com/v1";

// ── Auth header ────────────────────────────────────────────────────────────────
function authHeader(apiKey: string, apiSecret: string): string {
  return `ApiKey ${apiKey}:${apiSecret}`;
}

function spaceshipHeaders(apiKey: string, apiSecret: string): Record<string, string> {
  return {
    "Authorization": authHeader(apiKey, apiSecret),
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

// ── Exchange rate helper (USD→PKR + Rs.15 buffer) ────────────────────────────
export async function getUsdToPkrWithBuffer(): Promise<number> {
  try {
    const [row] = await db.select({ exchangeRate: currenciesTable.exchangeRate })
      .from(currenciesTable)
      .where(eq(currenciesTable.code, "PKR"))
      .limit(1);
    const base = Number(row?.exchangeRate ?? 280);
    return base + 15; // +Rs.15 conversion buffer
  } catch {
    return 295; // safe fallback: 280 + 15 buffer
  }
}

// ── Admin email / phone helpers ───────────────────────────────────────────────
async function getAdminEmail(): Promise<string> {
  try {
    const [row] = await db.select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, "admin_email"))
      .limit(1);
    return row?.value || "admin@noehost.com";
  } catch {
    return "admin@noehost.com";
  }
}

// ── Live TLD Price ────────────────────────────────────────────────────────────
export interface SpaceshipTldPrice {
  tld: string;
  registrationUsd: number | null;
  renewalUsd: number | null;
  transferUsd: number | null;
}

export async function fetchSpaceshipLivePrices(
  apiKey: string,
  apiSecret: string,
  tlds: string[],
): Promise<SpaceshipTldPrice[]> {
  const normalized = tlds.map(t => (t.startsWith(".") ? t : `.${t}`));
  const url = `${SPACESHIP_BASE}/tld/prices?tlds=${normalized.join(",")}`;
  const res = await fetch(url, {
    headers: spaceshipHeaders(apiKey, apiSecret),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spaceship /tld/prices failed (${res.status}): ${err}`);
  }
  const data = await res.json() as any[];
  return (Array.isArray(data) ? data : []).map((item: any) => ({
    tld: item.name ?? item.tld ?? "",
    registrationUsd: item.registration?.USD ?? item.registrationPrice ?? null,
    renewalUsd: item.renewal?.USD ?? item.renewalPrice ?? null,
    transferUsd: item.transfer?.USD ?? item.transferPrice ?? null,
  }));
}

// ── Single TLD cost helper ────────────────────────────────────────────────────
export async function fetchSpaceshipTldCost(
  apiKey: string,
  apiSecret: string,
  tld: string,
  action: "registration" | "renewal" | "transfer" = "registration",
): Promise<number | null> {
  const prices = await fetchSpaceshipLivePrices(apiKey, apiSecret, [tld]);
  const row = prices[0];
  if (!row) return null;
  if (action === "renewal") return row.renewalUsd;
  if (action === "transfer") return row.transferUsd;
  return row.registrationUsd;
}

// ── Account Balance ───────────────────────────────────────────────────────────
export interface SpaceshipBalance {
  balance: number;
  currency: string;
}

export async function fetchSpaceshipBalance(
  apiKey: string,
  apiSecret: string,
): Promise<SpaceshipBalance> {
  const res = await fetch(`${SPACESHIP_BASE}/account/balance`, {
    headers: spaceshipHeaders(apiKey, apiSecret),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spaceship /account/balance failed (${res.status}): ${err}`);
  }
  const data = await res.json() as any;
  return {
    balance: Number(data.balance ?? data.availableBalance ?? 0),
    currency: data.currency ?? "USD",
  };
}

// ── Loss-Prevention Kill Switch ───────────────────────────────────────────────
export interface LossCheckResult {
  allowed: boolean;
  liveCostUsd: number;
  liveCostPkr: number;
  usdToPkr: number;
  lossThresholdUsd: number;
  reason?: string;
}

export async function runLossPrevention(
  apiKey: string,
  apiSecret: string,
  tld: string,
  clientPaidPkr: number,
  lossThresholdUsd: number,
  domainFqdn: string,
  action: "registration" | "renewal" | "transfer" = "registration",
): Promise<LossCheckResult> {
  const usdToPkr = await getUsdToPkrWithBuffer();

  let liveCostUsd: number;
  try {
    const cost = await fetchSpaceshipTldCost(apiKey, apiSecret, tld, action);
    liveCostUsd = cost ?? 0;
  } catch {
    // If we can't fetch the price, allow but log
    console.warn(`[SPACESHIP] Could not fetch live price for ${tld} — allowing with warning`);
    return { allowed: true, liveCostUsd: 0, liveCostPkr: 0, usdToPkr, lossThresholdUsd };
  }

  const liveCostPkr = Math.round(liveCostUsd * usdToPkr);
  const allowed = liveCostUsd <= lossThresholdUsd;

  if (!allowed) {
    const reason = `Live API cost $${liveCostUsd} exceeds threshold $${lossThresholdUsd}`;
    const alertMsg = [
      `🚨 *SPACESHIP PRICE JUMP DETECTED*`,
      `Domain: ${domainFqdn}`,
      `Live API Cost: $${liveCostUsd} (Rs. ${liveCostPkr.toLocaleString()})`,
      `Client Paid: Rs. ${clientPaidPkr.toLocaleString()}`,
      `Your Threshold: $${lossThresholdUsd}`,
      `USD→PKR Rate Used: ${usdToPkr} (incl. Rs.15 buffer)`,
      `Action: Registration PAUSED ⛔`,
      `Login to admin panel to review and process manually.`,
    ].join("\n");

    // Fire-and-forget WhatsApp alert
    sendWhatsAppAlert("spaceship_price_jump", alertMsg).catch(() => {});

    // Also send admin email alert (imported lazily to avoid circular deps)
    try {
      const adminEmail = await getAdminEmail();
      const { emailSpaceshipPriceAlert } = await import("./email.js");
      await emailSpaceshipPriceAlert(adminEmail, {
        domainName: domainFqdn,
        liveCostUsd: String(liveCostUsd),
        liveCostPkr: String(liveCostPkr),
        clientPaidPkr: String(clientPaidPkr),
        thresholdUsd: String(lossThresholdUsd),
        usdToPkr: String(usdToPkr),
      });
    } catch (e) {
      console.error("[SPACESHIP] Price alert email failed:", e);
    }

    return { allowed: false, liveCostUsd, liveCostPkr, usdToPkr, lossThresholdUsd, reason };
  }

  return { allowed: true, liveCostUsd, liveCostPkr, usdToPkr, lossThresholdUsd };
}

// ── Register Domain ───────────────────────────────────────────────────────────
export async function spaceshipRegister(
  apiKey: string,
  apiSecret: string,
  domainName: string,
  period: number,
  nameservers: string[],
  useAccountBalance = true,
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const body: Record<string, any> = {
      domain: domainName,
      period,
      nameservers: nameservers.slice(0, 4).map((ns, i) => ({ host: ns, sortOrder: i + 1 })),
    };
    if (useAccountBalance) body.paymentMethod = "account_balance";

    const res = await fetch(`${SPACESHIP_BASE}/domains`, {
      method: "POST",
      headers: spaceshipHeaders(apiKey, apiSecret),
      body: JSON.stringify(body),
    });
    const data = await res.json() as any;
    if (res.ok) {
      return { success: true, result: data };
    }
    return { success: false, error: data?.message ?? data?.error ?? `HTTP ${res.status}`, result: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Renew Domain ─────────────────────────────────────────────────────────────
export async function spaceshipRenew(
  apiKey: string,
  apiSecret: string,
  domainName: string,
  period: number,
  useAccountBalance = true,
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const body: Record<string, any> = { period };
    if (useAccountBalance) body.paymentMethod = "account_balance";

    const res = await fetch(`${SPACESHIP_BASE}/domains/${encodeURIComponent(domainName)}/renewal`, {
      method: "POST",
      headers: spaceshipHeaders(apiKey, apiSecret),
      body: JSON.stringify(body),
    });
    const data = await res.json() as any;
    if (res.ok) return { success: true, result: data };
    return { success: false, error: data?.message ?? `HTTP ${res.status}`, result: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Transfer Domain ───────────────────────────────────────────────────────────
export async function spaceshipTransfer(
  apiKey: string,
  apiSecret: string,
  domainName: string,
  authCode: string,
  useAccountBalance = true,
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const body: Record<string, any> = { authCode };
    if (useAccountBalance) body.paymentMethod = "account_balance";

    const res = await fetch(`${SPACESHIP_BASE}/domains/${encodeURIComponent(domainName)}/transfer`, {
      method: "POST",
      headers: spaceshipHeaders(apiKey, apiSecret),
      body: JSON.stringify(body),
    });
    const data = await res.json() as any;
    if (res.ok) return { success: true, result: data };
    return { success: false, error: data?.message ?? `HTTP ${res.status}`, result: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Get EPP / Auth Code ───────────────────────────────────────────────────────
export async function spaceshipGetEpp(
  apiKey: string,
  apiSecret: string,
  domainName: string,
): Promise<{ success: boolean; eppCode?: string; error?: string }> {
  try {
    const res = await fetch(`${SPACESHIP_BASE}/domains/${encodeURIComponent(domainName)}/auth-code`, {
      headers: spaceshipHeaders(apiKey, apiSecret),
    });
    const data = await res.json() as any;
    if (res.ok) return { success: true, eppCode: data.authCode ?? data.auth_code ?? data.code ?? "" };
    return { success: false, error: data?.message ?? `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Get Nameservers ───────────────────────────────────────────────────────────
export async function spaceshipGetNameservers(
  apiKey: string,
  apiSecret: string,
  domainName: string,
): Promise<{ success: boolean; nameservers?: string[]; error?: string }> {
  try {
    const res = await fetch(`${SPACESHIP_BASE}/domains/${encodeURIComponent(domainName)}`, {
      headers: spaceshipHeaders(apiKey, apiSecret),
    });
    const data = await res.json() as any;
    if (res.ok) {
      const ns = (data.nameservers ?? data.ns ?? []).map((n: any) =>
        typeof n === "string" ? n : (n.host ?? n.name ?? "")
      ).filter(Boolean);
      return { success: true, nameservers: ns };
    }
    return { success: false, error: data?.message ?? `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Update Nameservers ────────────────────────────────────────────────────────
export async function spaceshipUpdateNameservers(
  apiKey: string,
  apiSecret: string,
  domainName: string,
  nameservers: string[],
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const body = {
      nameservers: nameservers.slice(0, 4).map((ns, i) => ({ host: ns, sortOrder: i + 1 })),
    };
    const res = await fetch(`${SPACESHIP_BASE}/domains/${encodeURIComponent(domainName)}/nameservers`, {
      method: "PUT",
      headers: spaceshipHeaders(apiKey, apiSecret),
      body: JSON.stringify(body),
    });
    const data = await res.json() as any;
    if (res.ok) return { success: true, result: data };
    return { success: false, error: data?.message ?? `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Get Registrar Lock Status ─────────────────────────────────────────────────
export async function spaceshipGetLock(
  apiKey: string,
  apiSecret: string,
  domainName: string,
): Promise<{ success: boolean; locked?: boolean; error?: string }> {
  try {
    const res = await fetch(`${SPACESHIP_BASE}/domains/${encodeURIComponent(domainName)}/registrar-lock`, {
      headers: spaceshipHeaders(apiKey, apiSecret),
    });
    const data = await res.json() as any;
    if (res.ok) return { success: true, locked: data.locked ?? data.status === "locked" };
    return { success: false, error: data?.message ?? `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Set Registrar Lock Status ─────────────────────────────────────────────────
export async function spaceshipSetLock(
  apiKey: string,
  apiSecret: string,
  domainName: string,
  locked: boolean,
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const res = await fetch(`${SPACESHIP_BASE}/domains/${encodeURIComponent(domainName)}/registrar-lock`, {
      method: "PUT",
      headers: spaceshipHeaders(apiKey, apiSecret),
      body: JSON.stringify({ locked }),
    });
    const data = await res.json() as any;
    if (res.ok) return { success: true, result: data };
    return { success: false, error: data?.message ?? `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Domain Info ────────────────────────────────────────────────────────────────
export async function spaceshipGetDomainInfo(
  apiKey: string,
  apiSecret: string,
  domainName: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${SPACESHIP_BASE}/domains/${encodeURIComponent(domainName)}`, {
      headers: spaceshipHeaders(apiKey, apiSecret),
    });
    const data = await res.json() as any;
    if (res.ok) return { success: true, data };
    return { success: false, error: data?.message ?? `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
