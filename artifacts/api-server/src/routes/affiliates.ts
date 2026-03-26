import { Router } from "express";
import { db } from "@workspace/db";
import {
  affiliatesTable,
  affiliateReferralsTable,
  affiliateCommissionsTable,
  affiliateClicksTable,
  affiliateWithdrawalsTable,
  affiliateGroupCommissionsTable,
  affiliatePlanCommissionsTable,
  usersTable,
  creditTransactionsTable,
  settingsTable,
  productGroupsTable,
  hostingPlansTable,
  vpsPlansTable,
} from "@workspace/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { authenticate, requireRole, type AuthRequest } from "../lib/auth.js";

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────────
function makeReferralCode(firstName: string, lastName: string): string {
  const base = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 8);
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}${suffix}`;
}

async function getOrCreateAffiliate(userId: string) {
  const [existing] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.userId, userId)).limit(1);
  if (existing) return existing;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return null;

  let code = makeReferralCode(user.firstName, user.lastName);
  let attempts = 0;
  while (attempts < 10) {
    const [taken] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.referralCode, code)).limit(1);
    if (!taken) break;
    code = makeReferralCode(user.firstName, user.lastName);
    attempts++;
  }

  const [affiliate] = await db.insert(affiliatesTable).values({
    userId,
    referralCode: code,
    status: "active",
    commissionType: "fixed",
    commissionValue: "500",
  }).returning();

  return affiliate;
}

async function getAffiliateSettings() {
  const rows = await db.select().from(settingsTable)
    .where(sql`${settingsTable.key} IN ('affiliate_payout_threshold', 'affiliate_cookie_days')`);
  const map: Record<string, string> = {};
  for (const r of rows) { if (r.key && r.value) map[r.key] = r.value; }
  return {
    payoutThreshold: parseFloat(map["affiliate_payout_threshold"] ?? "2000"),
    cookieDays: parseInt(map["affiliate_cookie_days"] ?? "30"),
  };
}

// ── Client: Get my affiliate profile ──────────────────────────────────────────
router.get("/affiliate", authenticate, async (req: AuthRequest, res) => {
  try {
    const affiliate = await getOrCreateAffiliate(req.user!.userId);
    if (!affiliate) { res.status(404).json({ error: "Not found" }); return; }

    const [commissions, referrals, settings, groupCommissions] = await Promise.all([
      db.select().from(affiliateCommissionsTable)
        .where(eq(affiliateCommissionsTable.affiliateId, affiliate.id))
        .orderBy(desc(affiliateCommissionsTable.createdAt))
        .limit(50),

      db.select({
        id: affiliateReferralsTable.id,
        status: affiliateReferralsTable.status,
        createdAt: affiliateReferralsTable.createdAt,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
      })
        .from(affiliateReferralsTable)
        .leftJoin(usersTable, eq(affiliateReferralsTable.referredUserId, usersTable.id))
        .where(eq(affiliateReferralsTable.affiliateId, affiliate.id))
        .orderBy(desc(affiliateReferralsTable.createdAt))
        .limit(20),

      getAffiliateSettings(),

      db.select().from(affiliateGroupCommissionsTable).where(eq(affiliateGroupCommissionsTable.isActive, true)),
    ]);

    res.json({ affiliate, commissions, referrals, settings, groupCommissions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Client: Update payout info ────────────────────────────────────────────────
router.put("/affiliate", authenticate, async (req: AuthRequest, res) => {
  try {
    const affiliate = await getOrCreateAffiliate(req.user!.userId);
    if (!affiliate) { res.status(404).json({ error: "Not found" }); return; }

    const { paypalEmail } = req.body;
    const [updated] = await db.update(affiliatesTable)
      .set({ paypalEmail: paypalEmail || null, updatedAt: new Date() })
      .where(eq(affiliatesTable.id, affiliate.id))
      .returning();

    res.json({ affiliate: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Public: Track a referral click ────────────────────────────────────────────
router.post("/affiliate/track", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json({ error: "Code required" }); return; }

    const [affiliate] = await db.select().from(affiliatesTable)
      .where(eq(affiliatesTable.referralCode, code)).limit(1);
    if (!affiliate || affiliate.status !== "active") { res.status(404).json({ error: "Invalid code" }); return; }

    const ip = (req.headers["x-forwarded-for"] as string || req.ip || "").split(",")[0]?.trim();
    const ua = req.headers["user-agent"] || "";

    await db.insert(affiliateClicksTable).values({ affiliateId: affiliate.id, ipAddress: ip, userAgent: ua });
    await db.update(affiliatesTable)
      .set({ totalClicks: sql`${affiliatesTable.totalClicks} + 1`, updatedAt: new Date() })
      .where(eq(affiliatesTable.id, affiliate.id));

    // Also return cookie duration so the frontend can set a proper cookie
    const settings = await getAffiliateSettings();
    res.json({ success: true, cookieDays: settings.cookieDays });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Client: Get my withdrawals ────────────────────────────────────────────────
router.get("/affiliate/withdrawals", authenticate, async (req: AuthRequest, res) => {
  try {
    const affiliate = await getOrCreateAffiliate(req.user!.userId);
    if (!affiliate) { res.status(404).json({ error: "Not found" }); return; }

    const withdrawals = await db.select().from(affiliateWithdrawalsTable)
      .where(eq(affiliateWithdrawalsTable.affiliateId, affiliate.id))
      .orderBy(desc(affiliateWithdrawalsTable.createdAt));

    res.json({ withdrawals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Client: Request a bank/JazzCash withdrawal ────────────────────────────────
router.post("/affiliate/withdraw", authenticate, async (req: AuthRequest, res) => {
  try {
    const affiliate = await getOrCreateAffiliate(req.user!.userId);
    if (!affiliate) { res.status(404).json({ error: "Not found" }); return; }

    const { amount, accountTitle, accountNumber, bankName } = req.body;
    const requested = parseFloat(amount);

    if (!amount || isNaN(requested) || requested <= 0) {
      res.status(400).json({ error: "Invalid amount" }); return;
    }

    const settings = await getAffiliateSettings();
    if (requested < settings.payoutThreshold) {
      res.status(400).json({ error: `Minimum payout is Rs. ${settings.payoutThreshold.toFixed(0)}` }); return;
    }

    const approvedBalance = parseFloat(affiliate.totalEarnings || "0")
      - parseFloat(affiliate.pendingEarnings || "0")
      - parseFloat(affiliate.paidEarnings || "0");

    if (requested > approvedBalance + 0.001) {
      res.status(400).json({ error: `Insufficient balance. Available: Rs. ${approvedBalance.toFixed(2)}` }); return;
    }

    if (!accountTitle || !accountNumber || !bankName) {
      res.status(400).json({ error: "Account title, account number, and bank/provider name are required" }); return;
    }

    const [withdrawal] = await db.insert(affiliateWithdrawalsTable).values({
      affiliateId: affiliate.id,
      amount: String(requested.toFixed(2)),
      status: "pending",
      payoutMethod: "bank",
      accountTitle,
      accountNumber,
      bankName,
    }).returning();

    res.status(201).json({ withdrawal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Client: Instantly transfer affiliate earnings to wallet ───────────────────
router.post("/affiliate/transfer-to-wallet", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { amount } = req.body || {};
    const requested = parseFloat(amount);

    if (!amount || isNaN(requested) || requested <= 0) {
      res.status(400).json({ error: "Invalid amount" }); return;
    }
    if (requested < 100) {
      res.status(400).json({ error: "Minimum transfer amount is Rs. 100" }); return;
    }

    const affiliate = await getOrCreateAffiliate(userId);
    if (!affiliate) { res.status(404).json({ error: "Affiliate account not found" }); return; }

    const totalEarnings = parseFloat(affiliate.totalEarnings ?? "0");
    const pendingEarnings = parseFloat(affiliate.pendingEarnings ?? "0");
    const paidEarnings = parseFloat(affiliate.paidEarnings ?? "0");
    const approvedBalance = totalEarnings - pendingEarnings - paidEarnings;

    if (requested > approvedBalance + 0.001) {
      res.status(400).json({ error: `Insufficient balance. Available: Rs. ${approvedBalance.toFixed(2)}` }); return;
    }

    const [user] = await db.select({ creditBalance: usersTable.creditBalance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const newCreditBalance = (parseFloat(user.creditBalance ?? "0") + requested).toFixed(2);
    const newPaidEarnings = (paidEarnings + requested).toFixed(2);

    await Promise.all([
      db.update(usersTable)
        .set({ creditBalance: newCreditBalance, updatedAt: new Date() })
        .where(eq(usersTable.id, userId)),
      db.update(affiliatesTable)
        .set({ paidEarnings: newPaidEarnings })
        .where(eq(affiliatesTable.id, affiliate.id)),
      db.insert(creditTransactionsTable).values({
        userId,
        amount: String(requested.toFixed(2)),
        type: "affiliate_payout",
        description: `Affiliate earnings transferred to wallet`,
      }),
    ]);

    res.json({ success: true, newBalance: newCreditBalance, transferred: requested.toFixed(2) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// IMPORTANT: Fixed-path routes MUST be before param routes (/admin/affiliates/:id)

// ── Admin: Get global affiliate settings ──────────────────────────────────────
router.get("/admin/affiliates/settings", authenticate, requireRole("admin"), async (_req, res) => {
  try {
    const settings = await getAffiliateSettings();
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Update global affiliate settings ───────────────────────────────────
router.put("/admin/affiliates/settings", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { payoutThreshold, cookieDays } = req.body || {};

    const updates: Array<{ key: string; value: string }> = [];
    if (payoutThreshold != null) updates.push({ key: "affiliate_payout_threshold", value: String(parseFloat(payoutThreshold)) });
    if (cookieDays != null) updates.push({ key: "affiliate_cookie_days", value: String(parseInt(cookieDays)) });

    for (const { key, value } of updates) {
      await db.insert(settingsTable).values({ key, value })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
    }

    const settings = await getAffiliateSettings();
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Get per-group commission rates ─────────────────────────────────────
router.get("/admin/affiliates/group-commissions", authenticate, requireRole("admin"), async (_req, res) => {
  try {
    const [groups, commissions] = await Promise.all([
      db.select().from(productGroupsTable).where(eq(productGroupsTable.isActive, true)).orderBy(productGroupsTable.sortOrder),
      db.select().from(affiliateGroupCommissionsTable),
    ]);

    const commMap: Record<string, any> = {};
    for (const c of commissions) { commMap[c.groupId] = c; }

    const result = groups.map(g => ({
      groupId: g.id,
      groupName: g.name,
      commissionType: commMap[g.id]?.commissionType ?? "fixed",
      commissionValue: commMap[g.id]?.commissionValue ?? "500",
      isActive: commMap[g.id]?.isActive ?? true,
      id: commMap[g.id]?.id ?? null,
    }));

    res.json({ groupCommissions: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Upsert a group commission rate ─────────────────────────────────────
router.put("/admin/affiliates/group-commissions/:groupId", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { groupId } = req.params;
    const { commissionType, commissionValue, isActive, groupName } = req.body;

    const [group] = await db.select().from(productGroupsTable).where(eq(productGroupsTable.id, groupId!)).limit(1);
    const name = groupName || group?.name || groupId!;

    const [existing] = await db.select().from(affiliateGroupCommissionsTable)
      .where(eq(affiliateGroupCommissionsTable.groupId, groupId!)).limit(1);

    let result;
    if (existing) {
      [result] = await db.update(affiliateGroupCommissionsTable)
        .set({
          commissionType: commissionType || existing.commissionType,
          commissionValue: commissionValue != null ? String(commissionValue) : existing.commissionValue,
          isActive: isActive != null ? isActive : existing.isActive,
          groupName: name,
          updatedAt: new Date(),
        })
        .where(eq(affiliateGroupCommissionsTable.id, existing.id))
        .returning();
    } else {
      [result] = await db.insert(affiliateGroupCommissionsTable).values({
        groupId: groupId!,
        groupName: name,
        commissionType: commissionType || "fixed",
        commissionValue: commissionValue != null ? String(commissionValue) : "500",
        isActive: isActive != null ? isActive : true,
      }).returning();
    }

    res.json({ groupCommission: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: List all commissions ────────────────────────────────────────────────
router.get("/admin/affiliates/commissions/all", authenticate, requireRole("admin"), async (_req, res) => {
  try {
    const commissions = await db.select({
      id: affiliateCommissionsTable.id,
      affiliateId: affiliateCommissionsTable.affiliateId,
      orderId: affiliateCommissionsTable.orderId,
      amount: affiliateCommissionsTable.amount,
      status: affiliateCommissionsTable.status,
      description: affiliateCommissionsTable.description,
      paidAt: affiliateCommissionsTable.paidAt,
      createdAt: affiliateCommissionsTable.createdAt,
      referralCode: affiliatesTable.referralCode,
      affiliateEmail: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    })
      .from(affiliateCommissionsTable)
      .leftJoin(affiliatesTable, eq(affiliateCommissionsTable.affiliateId, affiliatesTable.id))
      .leftJoin(usersTable, eq(affiliatesTable.userId, usersTable.id))
      .orderBy(desc(affiliateCommissionsTable.createdAt));

    res.json({ commissions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: List plan commissions ──────────────────────────────────────────────
// NOTE: Must be declared BEFORE the /admin/affiliates/:id wildcard to avoid
// Express matching "plan-commissions" as a literal :id value.
router.get("/admin/affiliates/plan-commissions", authenticate, requireRole("admin"), async (_req, res) => {
  try {
    const [hostingPlans, vpsPlans, planComms] = await Promise.all([
      db.select({ id: hostingPlansTable.id, name: hostingPlansTable.name, price: hostingPlansTable.price }).from(hostingPlansTable).where(eq(hostingPlansTable.isActive, true)),
      db.select({ id: vpsPlansTable.id, name: vpsPlansTable.name, price: vpsPlansTable.price }).from(vpsPlansTable).where(eq(vpsPlansTable.isActive, true)),
      db.select().from(affiliatePlanCommissionsTable),
    ]);
    const commMap: Record<string, typeof planComms[0]> = {};
    planComms.forEach(c => { commMap[c.planId] = c; });
    const allPlans = [
      ...hostingPlans.map(p => ({ ...p, planType: "hosting" as const })),
      ...vpsPlans.map(p => ({ ...p, planType: "vps" as const })),
    ].map(p => ({
      planId: p.id,
      planName: p.name,
      planType: p.planType,
      price: p.price,
      commission: commMap[p.id] ?? null,
    }));
    res.json({ plans: allPlans });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Upsert plan commission ─────────────────────────────────────────────
router.put("/admin/affiliates/plan-commissions/:planId", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { planId } = req.params;
    const { planName, planType = "hosting", commissionType = "fixed", commissionValue, isActive = true } = req.body;
    if (!planName || commissionValue === undefined) {
      res.status(400).json({ error: "planName and commissionValue are required" }); return;
    }
    const [existing] = await db.select().from(affiliatePlanCommissionsTable)
      .where(eq(affiliatePlanCommissionsTable.planId, planId!)).limit(1);
    let result;
    if (existing) {
      [result] = await db.update(affiliatePlanCommissionsTable)
        .set({ planName, planType, commissionType, commissionValue: String(commissionValue), isActive, updatedAt: new Date() })
        .where(eq(affiliatePlanCommissionsTable.planId, planId!))
        .returning();
    } else {
      [result] = await db.insert(affiliatePlanCommissionsTable)
        .values({ planId: planId!, planName, planType, commissionType, commissionValue: String(commissionValue), isActive })
        .returning();
    }
    res.json({ planCommission: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: List all affiliates ─────────────────────────────────────────────────
router.get("/admin/affiliates", authenticate, requireRole("admin"), async (_req, res) => {
  try {
    const affiliates = await db.select({
      id: affiliatesTable.id,
      userId: affiliatesTable.userId,
      referralCode: affiliatesTable.referralCode,
      status: affiliatesTable.status,
      commissionType: affiliatesTable.commissionType,
      commissionValue: affiliatesTable.commissionValue,
      totalEarnings: affiliatesTable.totalEarnings,
      pendingEarnings: affiliatesTable.pendingEarnings,
      paidEarnings: affiliatesTable.paidEarnings,
      totalClicks: affiliatesTable.totalClicks,
      totalSignups: affiliatesTable.totalSignups,
      totalConversions: affiliatesTable.totalConversions,
      paypalEmail: affiliatesTable.paypalEmail,
      notes: affiliatesTable.notes,
      createdAt: affiliatesTable.createdAt,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
    })
      .from(affiliatesTable)
      .leftJoin(usersTable, eq(affiliatesTable.userId, usersTable.id))
      .orderBy(desc(affiliatesTable.createdAt));

    res.json({ affiliates });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Get affiliate detail ─────────────────────────────────────────────────
router.get("/admin/affiliates/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const [affiliate] = await db.select().from(affiliatesTable).where(eq(affiliatesTable.id, req.params.id!)).limit(1);
    if (!affiliate) { res.status(404).json({ error: "Not found" }); return; }

    const commissions = await db.select().from(affiliateCommissionsTable)
      .where(eq(affiliateCommissionsTable.affiliateId, affiliate.id))
      .orderBy(desc(affiliateCommissionsTable.createdAt));

    res.json({ affiliate, commissions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Update individual affiliate settings ────────────────────────────────
router.put("/admin/affiliates/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { status, commissionType, commissionValue, notes } = req.body;
    const [updated] = await db.update(affiliatesTable)
      .set({
        ...(status ? { status } : {}),
        ...(commissionType ? { commissionType } : {}),
        ...(commissionValue != null ? { commissionValue: String(commissionValue) } : {}),
        ...(notes !== undefined ? { notes } : {}),
        updatedAt: new Date(),
      })
      .where(eq(affiliatesTable.id, req.params.id!))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ affiliate: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Approve commission ──────────────────────────────────────────────────
router.put("/admin/affiliates/commissions/:id/approve", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const [commission] = await db.select().from(affiliateCommissionsTable).where(eq(affiliateCommissionsTable.id, req.params.id!)).limit(1);
    if (!commission) { res.status(404).json({ error: "Not found" }); return; }
    if (commission.status !== "pending") {
      res.status(400).json({ error: `Commission is already ${commission.status}` }); return;
    }

    const [updated] = await db.update(affiliateCommissionsTable)
      .set({ status: "approved" })
      .where(eq(affiliateCommissionsTable.id, req.params.id!))
      .returning();

    await db.update(affiliatesTable)
      .set({
        pendingEarnings: sql`GREATEST(${affiliatesTable.pendingEarnings} - ${commission.amount}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(affiliatesTable.id, commission.affiliateId));

    res.json({ commission: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Reject commission ───────────────────────────────────────────────────
router.put("/admin/affiliates/commissions/:id/reject", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const [commission] = await db.select().from(affiliateCommissionsTable).where(eq(affiliateCommissionsTable.id, req.params.id!)).limit(1);
    if (!commission) { res.status(404).json({ error: "Not found" }); return; }
    if (commission.status !== "pending") {
      res.status(400).json({ error: `Commission is already ${commission.status}` }); return;
    }

    const [updated] = await db.update(affiliateCommissionsTable)
      .set({ status: "rejected" })
      .where(eq(affiliateCommissionsTable.id, req.params.id!))
      .returning();

    // Reduce both total and pending earnings since it was rejected
    await db.update(affiliatesTable)
      .set({
        totalEarnings: sql`GREATEST(${affiliatesTable.totalEarnings} - ${commission.amount}, 0)`,
        pendingEarnings: sql`GREATEST(${affiliatesTable.pendingEarnings} - ${commission.amount}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(affiliatesTable.id, commission.affiliateId));

    res.json({ commission: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Mark commission as paid ────────────────────────────────────────────
router.put("/admin/affiliates/commissions/:id/pay", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const [commission] = await db.select().from(affiliateCommissionsTable).where(eq(affiliateCommissionsTable.id, req.params.id!)).limit(1);
    if (!commission) { res.status(404).json({ error: "Not found" }); return; }

    const [updated] = await db.update(affiliateCommissionsTable)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(affiliateCommissionsTable.id, req.params.id!))
      .returning();

    if (commission.status === "approved") {
      await db.update(affiliatesTable)
        .set({
          paidEarnings: sql`${affiliatesTable.paidEarnings} + ${commission.amount}`,
          updatedAt: new Date(),
        })
        .where(eq(affiliatesTable.id, commission.affiliateId));
    }

    res.json({ commission: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: List all withdrawals ────────────────────────────────────────────────
router.get("/admin/affiliates/withdrawals/all", authenticate, requireRole("admin"), async (_req, res) => {
  try {
    const withdrawals = await db.select({
      id: affiliateWithdrawalsTable.id,
      affiliateId: affiliateWithdrawalsTable.affiliateId,
      amount: affiliateWithdrawalsTable.amount,
      status: affiliateWithdrawalsTable.status,
      payoutMethod: affiliateWithdrawalsTable.payoutMethod,
      paypalEmail: affiliateWithdrawalsTable.paypalEmail,
      accountTitle: affiliateWithdrawalsTable.accountTitle,
      accountNumber: affiliateWithdrawalsTable.accountNumber,
      bankName: affiliateWithdrawalsTable.bankName,
      adminNotes: affiliateWithdrawalsTable.adminNotes,
      createdAt: affiliateWithdrawalsTable.createdAt,
      referralCode: affiliatesTable.referralCode,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
    })
      .from(affiliateWithdrawalsTable)
      .leftJoin(affiliatesTable, eq(affiliateWithdrawalsTable.affiliateId, affiliatesTable.id))
      .leftJoin(usersTable, eq(affiliatesTable.userId, usersTable.id))
      .orderBy(desc(affiliateWithdrawalsTable.createdAt));

    res.json({ withdrawals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Approve withdrawal ──────────────────────────────────────────────────
router.put("/admin/affiliates/withdrawals/:id/approve", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const [w] = await db.select().from(affiliateWithdrawalsTable).where(eq(affiliateWithdrawalsTable.id, req.params.id!)).limit(1);
    if (!w) { res.status(404).json({ error: "Not found" }); return; }

    const { adminNotes } = req.body || {};
    const [updated] = await db.update(affiliateWithdrawalsTable)
      .set({ status: "approved", adminNotes: adminNotes || null, updatedAt: new Date() })
      .where(eq(affiliateWithdrawalsTable.id, req.params.id!))
      .returning();

    res.json({ withdrawal: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Mark withdrawal as paid ────────────────────────────────────────────
router.put("/admin/affiliates/withdrawals/:id/pay", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const [w] = await db.select().from(affiliateWithdrawalsTable).where(eq(affiliateWithdrawalsTable.id, req.params.id!)).limit(1);
    if (!w) { res.status(404).json({ error: "Not found" }); return; }
    if (w.status !== "approved") { res.status(400).json({ error: "Only approved withdrawals can be marked as paid" }); return; }

    const [updated] = await db.update(affiliateWithdrawalsTable)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(affiliateWithdrawalsTable.id, req.params.id!))
      .returning();

    await db.update(affiliatesTable)
      .set({
        paidEarnings: sql`${affiliatesTable.paidEarnings} + ${w.amount}`,
        updatedAt: new Date(),
      })
      .where(eq(affiliatesTable.id, w.affiliateId));

    // If bank transfer, do NOT credit wallet (admin transfers manually)
    // If wallet method, credit user's account
    if (w.payoutMethod === "wallet") {
      const [affiliate] = await db.select({ userId: affiliatesTable.userId })
        .from(affiliatesTable).where(eq(affiliatesTable.id, w.affiliateId)).limit(1);
      if (affiliate) {
        await db.update(usersTable)
          .set({ creditBalance: sql`COALESCE(${usersTable.creditBalance}, 0) + ${w.amount}`, updatedAt: new Date() })
          .where(eq(usersTable.id, affiliate.userId));

        await db.insert(creditTransactionsTable).values({
          userId: affiliate.userId,
          amount: w.amount,
          type: "affiliate_payout",
          description: `Affiliate commission payout`,
          withdrawalId: w.id,
          performedBy: req.user!.userId,
        });
      }
    }

    res.json({ withdrawal: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Reject withdrawal ───────────────────────────────────────────────────
router.put("/admin/affiliates/withdrawals/:id/reject", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { adminNotes } = req.body || {};
    const [updated] = await db.update(affiliateWithdrawalsTable)
      .set({ status: "rejected", adminNotes: adminNotes || null, updatedAt: new Date() })
      .where(eq(affiliateWithdrawalsTable.id, req.params.id!))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ withdrawal: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Public: Available offers (active plan commissions for client dashboard) ───
router.get("/affiliate/offers", authenticate, async (_req, res) => {
  try {
    const offers = await db.select().from(affiliatePlanCommissionsTable)
      .where(eq(affiliatePlanCommissionsTable.isActive, true));
    res.json({ offers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
