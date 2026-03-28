/**
 * Domain Activation Management API
 * Manual Approval & Price Verification System
 *
 * Flow:
 *  1. Client pays → order becomes "paid", domain stays "pending"
 *  2. Admin opens Pending Activations dashboard
 *  3. Admin selects registrar → system fetches live cost + shows margin
 *  4. Admin clicks Confirm & Register → API call fired, domain activated, log saved
 */

import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  domainRegistrarsTable, domainsTable, ordersTable,
  invoicesTable, usersTable, domainActivationLogsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, or } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import {
  fetchSpaceshipLivePrices,
  fetchSpaceshipTldCost,
  runLossPrevention,
  spaceshipRegister,
  getUsdToPkrWithBuffer,
} from "../lib/spaceship.js";
import { emailDomainRegistered } from "../lib/email.js";

const router = Router();

// ── Helper: call registrar API for registration ───────────────────────────────
async function registerWithRegistrar(
  reg: any,
  fullDomain: string,
  tld: string,
  period: number,
  clientPaidPkr: number,
): Promise<{
  success: boolean;
  error?: string;
  result?: any;
  costUsd?: number;
  costPkr?: number;
  usdToPkr?: number;
  profitPkr?: number;
}> {
  const config = JSON.parse(reg.config ?? "{}");
  const nsArr = ["ns1.noehost.com", "ns2.noehost.com"];

  if (reg.type === "spaceship") {
    const lossThreshold = Number(config.lossThresholdUsd ?? 1.5);
    const lossCheck = await runLossPrevention(
      config.apiKey, config.apiSecret, tld,
      clientPaidPkr, lossThreshold, fullDomain, "registration",
    );
    if (!lossCheck.allowed) {
      return {
        success: false,
        error: `Loss-prevention triggered: live cost $${lossCheck.liveCostUsd} > threshold $${lossCheck.lossThresholdUsd}`,
        costUsd: lossCheck.liveCostUsd,
        costPkr: lossCheck.liveCostPkr,
        usdToPkr: lossCheck.usdToPkr,
      };
    }

    const useWallet = config.useAccountBalance !== "false";
    const r = await spaceshipRegister(config.apiKey, config.apiSecret, fullDomain, period, nsArr, useWallet);
    return {
      ...r,
      costUsd: lossCheck.liveCostUsd,
      costPkr: lossCheck.liveCostPkr,
      usdToPkr: lossCheck.usdToPkr,
      profitPkr: Math.max(0, clientPaidPkr - lossCheck.liveCostPkr),
    };
  }

  // For non-spaceship registrars, record cost as 0 (manual pricing)
  return { success: true, result: { manual: true }, costUsd: 0, costPkr: 0, profitPkr: clientPaidPkr };
}

// ── GET /admin/domains/pending-activation ─────────────────────────────────────
// Returns all domain orders that have been paid but not yet activated
router.get("/admin/domains/pending-activation", authenticate, requireAdmin,
  async (_req: AuthRequest, res: Response) => {
    try {
      // Get all domain orders that are paid + status is pending/pending_activation
      const orders = await db.select({
        orderId:    ordersTable.id,
        domain:     ordersTable.domain,
        itemName:   ordersTable.itemName,
        amount:     ordersTable.amount,
        paymentStatus: ordersTable.paymentStatus,
        orderStatus:   ordersTable.status,
        billingCycle:  ordersTable.billingCycle,
        invoiceId:  ordersTable.invoiceId,
        clientId:   ordersTable.clientId,
        orderCreatedAt: ordersTable.createdAt,
        clientFirstName: usersTable.firstName,
        clientLastName:  usersTable.lastName,
        clientEmail:     usersTable.email,
      })
      .from(ordersTable)
      .leftJoin(usersTable, eq(ordersTable.clientId, usersTable.id))
      .where(
        and(
          eq(ordersTable.type, "domain"),
          eq(ordersTable.paymentStatus, "paid"),
          inArray(ordersTable.status, ["pending"]),
        )
      )
      .orderBy(ordersTable.createdAt);

      // For each order, find matching domain record
      const results = await Promise.all(orders.map(async (order) => {
        const fullDomain = order.domain || order.itemName || "";
        const dotIdx = fullDomain.indexOf(".");
        const name = dotIdx > 0 ? fullDomain.substring(0, dotIdx) : fullDomain;
        const tld = dotIdx > 0 ? fullDomain.substring(dotIdx) : ".com";

        const [domainRow] = await db.select().from(domainsTable)
          .where(
            and(
              eq(domainsTable.clientId, order.clientId),
              or(eq(domainsTable.status, "pending"), eq(domainsTable.status, "pending_activation")),
            )
          )
          .limit(1);

        const domainStatus = domainRow?.status ?? "pending";
        const domainId = domainRow?.id ?? null;

        return {
          orderId:    order.orderId,
          domainId,
          fullDomain,
          name,
          tld,
          domainStatus,
          amount:     Number(order.amount),
          billingCycle: order.billingCycle,
          paymentStatus: order.paymentStatus,
          orderStatus:   order.orderStatus,
          invoiceId:  order.invoiceId,
          clientId:   order.clientId,
          clientName: `${order.clientFirstName ?? ""} ${order.clientLastName ?? ""}`.trim(),
          clientEmail:  order.clientEmail,
          orderCreatedAt: order.orderCreatedAt,
        };
      }));

      // Filter to only truly pending (no active domain record)
      const pending = results.filter(r => r.domainStatus !== "active");

      res.json({ success: true, count: pending.length, items: pending });
    } catch (err: any) {
      console.error("[DOMAIN-ACTIVATION] pending list error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── POST /admin/domains/prepare-activation ────────────────────────────────────
// Given orderId + registrarId, fetch live cost and calculate margin
// Does NOT register — just returns price data for the admin to review
router.post("/admin/domains/prepare-activation", authenticate, requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { orderId, registrarId } = req.body as { orderId: string; registrarId: string };
      if (!orderId) { res.status(400).json({ error: "orderId required" }); return; }

      const [order] = await db.select().from(ordersTable)
        .where(eq(ordersTable.id, orderId)).limit(1);
      if (!order) { res.status(404).json({ error: "Order not found" }); return; }

      const fullDomain = order.domain || order.itemName || "";
      const dotIdx = fullDomain.indexOf(".");
      const tld = dotIdx > 0 ? fullDomain.substring(dotIdx) : ".com";
      const clientPaidPkr = Number(order.amount);

      // Get registrar
      if (!registrarId || registrarId === "none") {
        return res.json({
          success: true,
          fullDomain,
          tld,
          clientPaidPkr,
          registrarType: "none",
          liveCostUsd: 0,
          liveCostPkr: 0,
          usdToPkr: 0,
          profitPkr: clientPaidPkr,
          lossRisk: false,
          lossThresholdUsd: 1.5,
          message: "Manual registration — no API cost",
        });
      }

      const [reg] = await db.select().from(domainRegistrarsTable)
        .where(eq(domainRegistrarsTable.id, registrarId)).limit(1);
      if (!reg) { res.status(404).json({ error: "Registrar not found" }); return; }

      const config = JSON.parse(reg.config ?? "{}");
      const lossThresholdUsd = Number(config.lossThresholdUsd ?? 1.5);

      let liveCostUsd = 0;
      let usdToPkr = 0;
      let priceError: string | undefined;

      if (reg.type === "spaceship") {
        try {
          usdToPkr = await getUsdToPkrWithBuffer();
          const cost = await fetchSpaceshipTldCost(config.apiKey, config.apiSecret, tld, "registration");
          liveCostUsd = cost ?? 0;
        } catch (e: any) {
          priceError = `Could not fetch live price: ${e.message}`;
        }
      } else {
        usdToPkr = await getUsdToPkrWithBuffer();
      }

      const liveCostPkr = Math.round(liveCostUsd * usdToPkr);
      const profitPkr = clientPaidPkr - liveCostPkr;
      const lossRisk = liveCostUsd > lossThresholdUsd;

      res.json({
        success: true,
        fullDomain,
        tld,
        clientPaidPkr,
        registrarId,
        registrarName: reg.name,
        registrarType: reg.type,
        liveCostUsd,
        liveCostPkr,
        usdToPkr,
        profitPkr,
        lossRisk,
        lossThresholdUsd,
        priceError,
        buffer: 10,
      });
    } catch (err: any) {
      console.error("[DOMAIN-ACTIVATION] prepare error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── POST /admin/domains/confirm-activation ────────────────────────────────────
// Actually registers the domain with the registrar + activates the order
router.post("/admin/domains/confirm-activation", authenticate, requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        orderId, registrarId,
        period = 1, notes,
        skipApiCall = false,
      } = req.body as {
        orderId: string; registrarId?: string; period?: number;
        notes?: string; skipApiCall?: boolean;
      };

      if (!orderId) { res.status(400).json({ error: "orderId required" }); return; }

      const [order] = await db.select().from(ordersTable)
        .where(eq(ordersTable.id, orderId)).limit(1);
      if (!order) { res.status(404).json({ error: "Order not found" }); return; }
      if (order.type !== "domain") { res.status(400).json({ error: "Not a domain order" }); return; }

      const fullDomain = order.domain || order.itemName || "";
      const dotIdx = fullDomain.indexOf(".");
      const domainName = dotIdx > 0 ? fullDomain.substring(0, dotIdx) : fullDomain;
      const tld = dotIdx > 0 ? fullDomain.substring(dotIdx) : ".com";
      const clientPaidPkr = Number(order.amount);

      let registrarName = "manual";
      let registrarType = "none";
      let apiCallResult: any = null;
      let costUsd = 0;
      let costPkr = 0;
      let profitPkr = clientPaidPkr;
      let usdToPkrUsed = 0;

      if (registrarId && registrarId !== "none" && !skipApiCall) {
        const [reg] = await db.select().from(domainRegistrarsTable)
          .where(eq(domainRegistrarsTable.id, registrarId)).limit(1);

        if (reg) {
          registrarName = reg.name;
          registrarType = reg.type;

          const r = await registerWithRegistrar(reg, fullDomain, tld, period, clientPaidPkr);
          apiCallResult = r;
          costUsd = r.costUsd ?? 0;
          costPkr = r.costPkr ?? 0;
          usdToPkrUsed = r.usdToPkr ?? 0;
          profitPkr = r.profitPkr ?? (clientPaidPkr - costPkr);

          if (!r.success) {
            res.status(402).json({
              aborted: true,
              lossPreventionTriggered: reg.type === "spaceship",
              reason: r.error,
              costUsd,
              costPkr,
              message: r.error,
            });
            return;
          }
        }
      } else if (registrarId && registrarId !== "none" && skipApiCall) {
        const [reg] = await db.select().from(domainRegistrarsTable)
          .where(eq(domainRegistrarsTable.id, registrarId)).limit(1);
        if (reg) { registrarName = reg.name; registrarType = reg.type; }
      }

      // Create / update domain record
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + (period || 1));

      const existing = await db.select().from(domainsTable)
        .where(eq(domainsTable.clientId, order.clientId));
      const found = existing.find(d =>
        d.name === domainName && d.tld === tld
      );

      let domain: any;
      if (found) {
        [domain] = await db.update(domainsTable)
          .set({
            status: "active",
            registrar: registrarName,
            expiryDate,
            nextDueDate: expiryDate,
            nameservers: ["ns1.noehost.com", "ns2.noehost.com"],
            updatedAt: new Date(),
          })
          .where(eq(domainsTable.id, found.id))
          .returning();
      } else {
        [domain] = await db.insert(domainsTable).values({
          clientId: order.clientId,
          name: domainName,
          tld,
          status: "active",
          registrar: registrarName,
          registrationDate: new Date(),
          expiryDate,
          nextDueDate: expiryDate,
          nameservers: ["ns1.noehost.com", "ns2.noehost.com"],
          lockStatus: "locked",
        }).returning();
      }

      // Mark order approved
      await db.update(ordersTable)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(ordersTable.id, orderId));

      // Mark invoice paid
      if (order.invoiceId) {
        await db.update(invoicesTable as any)
          .set({ status: "paid" })
          .where(eq((invoicesTable as any).id, order.invoiceId));
      }

      // Write activation log
      await db.insert(domainActivationLogsTable).values({
        orderId,
        domainId: domain.id,
        clientId: order.clientId,
        domainFqdn: fullDomain,
        registrarId: registrarId ?? null,
        registrarName,
        registrarType,
        costUsd: costUsd > 0 ? String(costUsd) : null,
        costPkr: costPkr > 0 ? String(costPkr) : null,
        clientPaidPkr: String(clientPaidPkr),
        profitPkr: String(profitPkr),
        usdToPkr: usdToPkrUsed > 0 ? String(usdToPkrUsed) : null,
        apiSuccess: apiCallResult?.success === false ? "false" : "true",
        apiError: apiCallResult?.error ?? null,
        notes: notes ?? null,
      });

      // Send welcome email
      try {
        const [client] = await db.select().from(usersTable)
          .where(eq(usersTable.id, order.clientId)).limit(1);
        if (client?.email) {
          await emailDomainRegistered(client.email, {
            clientName: `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || client.email,
            domain: fullDomain,
            expiryDate: expiryDate.toLocaleDateString("en-GB"),
            ns1: "ns1.noehost.com",
            ns2: "ns2.noehost.com",
          }, { clientId: order.clientId, referenceId: orderId });
        }
      } catch (e) {
        console.warn("[DOMAIN-ACTIVATION] Welcome email failed (non-fatal):", e);
      }

      res.json({
        success: true,
        domain: { id: domain.id, name: domain.name, tld: domain.tld, status: domain.status },
        registrar: registrarName,
        costUsd,
        costPkr,
        profitPkr,
        apiCallResult,
        message: `${fullDomain} activated via ${registrarName}`,
      });
    } catch (err: any) {
      console.error("[DOMAIN-ACTIVATION] confirm error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── POST /admin/domains/bulk-confirm-activation ───────────────────────────────
// Activate multiple domains with the same registrar
router.post("/admin/domains/bulk-confirm-activation", authenticate, requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { orderIds, registrarId, period = 1 } = req.body as {
        orderIds: string[]; registrarId?: string; period?: number;
      };
      if (!orderIds?.length) { res.status(400).json({ error: "orderIds required" }); return; }

      const results = await Promise.allSettled(
        orderIds.map(async (orderId) => {
          const orders = await db.select().from(ordersTable)
            .where(eq(ordersTable.id, orderId)).limit(1);
          const order = orders[0];
          if (!order) throw new Error(`Order ${orderId} not found`);

          const fullDomain = order.domain || order.itemName || "";
          const dotIdx = fullDomain.indexOf(".");
          const domainName = dotIdx > 0 ? fullDomain.substring(0, dotIdx) : fullDomain;
          const tld = dotIdx > 0 ? fullDomain.substring(dotIdx) : ".com";
          const clientPaidPkr = Number(order.amount);

          let registrarName = "manual";
          let registrarType = "none";
          let costUsd = 0;
          let costPkr = 0;
          let profitPkr = clientPaidPkr;
          let usdToPkrUsed = 0;
          let apiCallResult: any = null;

          if (registrarId && registrarId !== "none") {
            const [reg] = await db.select().from(domainRegistrarsTable)
              .where(eq(domainRegistrarsTable.id, registrarId)).limit(1);
            if (reg) {
              registrarName = reg.name;
              registrarType = reg.type;
              const r = await registerWithRegistrar(reg, fullDomain, tld, period, clientPaidPkr);
              apiCallResult = r;
              costUsd = r.costUsd ?? 0;
              costPkr = r.costPkr ?? 0;
              usdToPkrUsed = r.usdToPkr ?? 0;
              profitPkr = r.profitPkr ?? (clientPaidPkr - costPkr);
              if (!r.success) throw new Error(r.error ?? "Registration failed");
            }
          }

          // Activate domain
          const expiryDate = new Date();
          expiryDate.setFullYear(expiryDate.getFullYear() + (period || 1));

          const existing = await db.select().from(domainsTable)
            .where(eq(domainsTable.clientId, order.clientId));
          const found = existing.find(d => d.name === domainName && d.tld === tld);

          let domain: any;
          if (found) {
            [domain] = await db.update(domainsTable)
              .set({ status: "active", registrar: registrarName, expiryDate, nextDueDate: expiryDate, updatedAt: new Date() })
              .where(eq(domainsTable.id, found.id)).returning();
          } else {
            [domain] = await db.insert(domainsTable).values({
              clientId: order.clientId, name: domainName, tld,
              status: "active", registrar: registrarName,
              registrationDate: new Date(), expiryDate, nextDueDate: expiryDate,
              nameservers: ["ns1.noehost.com", "ns2.noehost.com"], lockStatus: "locked",
            }).returning();
          }

          await db.update(ordersTable).set({ status: "approved", updatedAt: new Date() })
            .where(eq(ordersTable.id, orderId));

          if (order.invoiceId) {
            await db.update(invoicesTable as any)
              .set({ status: "paid" })
              .where(eq((invoicesTable as any).id, order.invoiceId));
          }

          await db.insert(domainActivationLogsTable).values({
            orderId,
            domainId: domain.id,
            clientId: order.clientId,
            domainFqdn: fullDomain,
            registrarId: registrarId ?? null,
            registrarName,
            registrarType,
            costUsd: costUsd > 0 ? String(costUsd) : null,
            costPkr: costPkr > 0 ? String(costPkr) : null,
            clientPaidPkr: String(clientPaidPkr),
            profitPkr: String(profitPkr),
            usdToPkr: usdToPkrUsed > 0 ? String(usdToPkrUsed) : null,
            apiSuccess: apiCallResult?.success === false ? "false" : "true",
          });

          return { orderId, fullDomain, success: true };
        })
      );

      const succeeded = results.filter(r => r.status === "fulfilled").map(r => (r as any).value);
      const failed = results
        .filter(r => r.status === "rejected")
        .map((r, i) => ({ orderId: orderIds[i], error: (r as any).reason?.message }));

      res.json({ succeeded, failed, total: orderIds.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── GET /admin/domains/activation-logs ───────────────────────────────────────
router.get("/admin/domains/activation-logs", authenticate, requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const logs = await db.select().from(domainActivationLogsTable)
        .orderBy(domainActivationLogsTable.activatedAt);
      res.json(logs.reverse());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;
