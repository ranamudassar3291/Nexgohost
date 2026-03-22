import { Router } from "express";
import { db } from "@workspace/db";
import {
  affiliatesTable,
  affiliateReferralsTable,
  affiliateCommissionsTable,
  affiliateClicksTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { authenticate, requireRole, type AuthRequest } from "../lib/auth.js";

const router = Router();

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
    commissionType: "percentage",
    commissionValue: "10",
  }).returning();

  return affiliate;
}

// ── Client: Get my affiliate profile ──────────────────────────────────────────
router.get("/affiliate", authenticate, async (req: AuthRequest, res) => {
  try {
    const affiliate = await getOrCreateAffiliate(req.user!.userId);
    if (!affiliate) { res.status(404).json({ error: "Not found" }); return; }

    const commissions = await db.select().from(affiliateCommissionsTable)
      .where(eq(affiliateCommissionsTable.affiliateId, affiliate.id))
      .orderBy(desc(affiliateCommissionsTable.createdAt))
      .limit(20);

    const referrals = await db.select({
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
      .limit(20);

    res.json({ affiliate, commissions, referrals });
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

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: List all commissions ────────────────────────────────────────────────
// IMPORTANT: This MUST be before /admin/affiliates/:id to avoid "commissions" matching as :id
router.get("/admin/affiliates/commissions/all", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
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

// ── Admin: List all affiliates ────────────────────────────────────────────────
router.get("/admin/affiliates", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
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

// ── Admin: Get affiliate detail ────────────────────────────────────────────────
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

// ── Admin: Update affiliate settings ──────────────────────────────────────────
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

    const [updated] = await db.update(affiliateCommissionsTable)
      .set({ status: "approved" })
      .where(eq(affiliateCommissionsTable.id, req.params.id!))
      .returning();

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

    // Update affiliate paid/pending earnings
    if (commission.status === "approved") {
      await db.update(affiliatesTable)
        .set({
          paidEarnings: sql`${affiliatesTable.paidEarnings} + ${commission.amount}`,
          pendingEarnings: sql`GREATEST(${affiliatesTable.pendingEarnings} - ${commission.amount}, 0)`,
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

export default router;
