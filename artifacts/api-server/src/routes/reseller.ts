import { Router } from "express";
import { db } from "@workspace/db";
import { sql, eq, desc, and } from "drizzle-orm";
import { authenticate, requireAdmin } from "../lib/auth.js";
import crypto from "crypto";

const router = Router();

function genApiKey(): string {
  return "rs_" + crypto.randomBytes(28).toString("hex");
}

// ── Public: TLD pricing table ─────────────────────────────────────────────────
router.get("/reseller/pricing", async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT id, tld, retail_price, reseller_price
      FROM reseller_domain_pricing
      ORDER BY tld ASC
    `);
    res.json(rows.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Public: Apply for reseller program (auth required) ────────────────────────
router.post("/reseller/apply", authenticate, async (req, res) => {
  try {
    const {
      businessName, websiteUrl, targetMarket, monthlyVolume,
      currentRegistrar, billingSoftware, selectedTier,
    } = req.body as {
      businessName?: string; websiteUrl?: string; targetMarket?: string;
      monthlyVolume?: string; currentRegistrar?: string;
      billingSoftware?: string; selectedTier?: string;
    };
    if (!businessName?.trim()) {
      res.status(400).json({ error: "Business name is required" });
      return;
    }
    const userId = req.user!.userId;

    // Check for existing profile
    const existing = await db.execute(sql`
      SELECT id, status FROM reseller_profiles WHERE user_id = ${userId} LIMIT 1
    `);
    if (existing.rows.length > 0) {
      res.json({ success: true, status: existing.rows[0].status, existing: true });
      return;
    }

    // Derive tier number from selectedTier string
    const tierNum = selectedTier === "enterprise" ? 3 : selectedTier === "professional" ? 2 : 1;

    // Save full application
    await db.execute(sql`
      INSERT INTO reseller_applications
        (user_id, business_name, website_url, target_market, monthly_volume,
         current_registrar, billing_software, selected_tier, status)
      VALUES
        (${userId}, ${businessName.trim()}, ${websiteUrl ?? ""},
         ${targetMarket ?? ""}, ${monthlyVolume ?? ""},
         ${currentRegistrar ?? ""}, ${billingSoftware ?? ""},
         ${selectedTier ?? "starter"}, 'pending_review')
    `);

    // Create reseller profile
    await db.execute(sql`
      INSERT INTO reseller_profiles (user_id, business_name, monthly_volume, status, discount_slab_tier)
      VALUES (${userId}, ${businessName.trim()}, ${monthlyVolume ?? ""}, 'pending', ${tierNum})
    `);

    res.json({ success: true, status: "pending" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Client: Get own reseller profile ─────────────────────────────────────────
router.get("/my/reseller/profile", authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const profile = await db.execute(sql`
      SELECT p.id, p.business_name, p.monthly_volume, p.status, p.api_key,
             p.discount_slab_tier, p.created_at,
             COALESCE(f.balance, 0) AS balance,
             f.currency
      FROM reseller_profiles p
      LEFT JOIN reseller_funds f ON f.user_id = p.user_id
      WHERE p.user_id = ${userId}
      LIMIT 1
    `);
    if (profile.rows.length === 0) {
      res.json({ profile: null });
      return;
    }
    res.json({ profile: profile.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Client: Get funds balance ─────────────────────────────────────────────────
router.get("/my/reseller/funds", authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const row = await db.execute(sql`
      SELECT balance, currency, updated_at FROM reseller_funds WHERE user_id = ${userId} LIMIT 1
    `);
    res.json({
      balance: row.rows[0]?.balance ?? "0.00",
      currency: row.rows[0]?.currency ?? "USD",
      updatedAt: row.rows[0]?.updated_at ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Client: Top-up reseller funds ────────────────────────────────────────────
router.post("/my/reseller/funds/topup", authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const amount = parseFloat(req.body.amount ?? "0");
    if (isNaN(amount) || amount <= 0) {
      res.status(400).json({ error: "Invalid amount" });
      return;
    }

    const profile = await db.execute(sql`
      SELECT id, status FROM reseller_profiles WHERE user_id = ${userId} LIMIT 1
    `);
    if (!profile.rows.length || profile.rows[0].status !== "active") {
      res.status(403).json({ error: "Reseller account is not active" });
      return;
    }

    await db.execute(sql`
      INSERT INTO reseller_funds (user_id, balance, currency)
      VALUES (${userId}, ${amount}, 'USD')
      ON CONFLICT (user_id) DO UPDATE
      SET balance = reseller_funds.balance + ${amount},
          updated_at = NOW()
    `);

    await db.execute(sql`
      INSERT INTO reseller_transactions (user_id, type, amount, notes)
      VALUES (${userId}, 'credit', ${amount}, 'Manual top-up')
    `);

    const updated = await db.execute(sql`SELECT balance FROM reseller_funds WHERE user_id = ${userId}`);
    res.json({ success: true, balance: updated.rows[0]?.balance ?? amount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Client: Domain orders ─────────────────────────────────────────────────────
router.get("/my/reseller/orders", authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const orders = await db.execute(sql`
      SELECT id, domain_name, tld, action_type, cost, status, nameservers, created_at
      FROM reseller_orders
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `);
    res.json(orders.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Client: Renew domain ──────────────────────────────────────────────────────
router.post("/my/reseller/orders/:id/renew", authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const order = await db.execute(sql`
      SELECT o.id, o.domain_name, o.tld, o.cost
      FROM reseller_orders o
      WHERE o.id = ${id} AND o.user_id = ${userId}
      LIMIT 1
    `);
    if (!order.rows.length) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const cost = parseFloat(order.rows[0].cost as string);
    const fundsRow = await db.execute(sql`
      SELECT balance FROM reseller_funds WHERE user_id = ${userId} LIMIT 1
    `);
    const balance = parseFloat(fundsRow.rows[0]?.balance as string ?? "0");

    if (balance < cost) {
      res.status(400).json({ error: "Insufficient reseller funds. Please top up your balance." });
      return;
    }

    // ── Transaction: balance deduction + ledger entry + order must all succeed ──
    const renewId = crypto.randomUUID();
    const renewNotes = "Domain renewal: " + order.rows[0].domain_name + order.rows[0].tld;
    await db.execute(sql`BEGIN`);
    try {
      await db.execute(sql`
        UPDATE reseller_funds SET balance = balance - ${cost}, updated_at = NOW()
        WHERE user_id = ${userId}
      `);
      await db.execute(sql`
        INSERT INTO reseller_transactions (user_id, type, amount, notes)
        VALUES (${userId}, 'debit', ${cost}, ${renewNotes})
      `);
      await db.execute(sql`
        INSERT INTO reseller_orders (id, user_id, domain_name, tld, action_type, cost, status)
        VALUES (${renewId}, ${userId}, ${order.rows[0].domain_name}, ${order.rows[0].tld}, 'renew', ${cost}, 'processing')
      `);
      await db.execute(sql`COMMIT`);
    } catch (txErr: any) {
      await db.execute(sql`ROLLBACK`).catch(() => {});
      console.error("[RESELLER RENEW] Transaction rolled back — balance NOT deducted:", txErr);
      throw txErr;
    }

    res.json({ success: true, orderId: renewId });
  } catch (err: any) {
    console.error("[RESELLER RENEW] raw error:", err);
    res.status(500).json({ error: "Domain renewal could not be processed. Your balance has not been charged. Please try again." });
  }
});

// ── Client: Get EPP / Auth code ────────────────────────────────────────────────
router.get("/my/reseller/orders/:id/epp", authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const order = await db.execute(sql`
      SELECT id, domain_name, tld, epp_code FROM reseller_orders
      WHERE id = ${id} AND user_id = ${userId} LIMIT 1
    `);
    if (!order.rows.length) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const epp = order.rows[0].epp_code || "EPP-" + crypto.randomBytes(8).toString("hex").toUpperCase();
    if (!order.rows[0].epp_code) {
      await db.execute(sql`UPDATE reseller_orders SET epp_code = ${epp} WHERE id = ${id}`);
    }
    res.json({ eppCode: epp });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Client: Update nameservers ────────────────────────────────────────────────
router.put("/my/reseller/orders/:id/nameservers", authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { ns1, ns2, ns3, ns4 } = req.body as {
      ns1?: string; ns2?: string; ns3?: string; ns4?: string;
    };
    const ns = [ns1, ns2, ns3, ns4].filter(Boolean).join(",");
    await db.execute(sql`
      UPDATE reseller_orders SET nameservers = ${ns}
      WHERE id = ${id} AND user_id = ${userId}
    `);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Client: Regenerate API key ────────────────────────────────────────────────
router.post("/my/reseller/api-key/regenerate", authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const newKey = genApiKey();
    await db.execute(sql`
      UPDATE reseller_profiles SET api_key = ${newKey} WHERE user_id = ${userId}
    `);
    res.json({ success: true, apiKey: newKey });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: List all reseller applications ─────────────────────────────────────
router.get("/admin/resellers", authenticate, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT p.id, p.user_id, p.business_name, p.monthly_volume, p.status,
             p.api_key, p.discount_slab_tier, p.created_at,
             u.name AS client_name, u.email AS client_email,
             COALESCE(f.balance, 0) AS balance
      FROM reseller_profiles p
      JOIN users u ON u.id::text = p.user_id
      LEFT JOIN reseller_funds f ON f.user_id = p.user_id
      ORDER BY p.created_at DESC
    `);
    res.json(rows.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Approve application ────────────────────────────────────────────────
router.put("/admin/resellers/:id/approve", authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { discountTier } = req.body as { discountTier?: number };
    const apiKey = genApiKey();

    const profile = await db.execute(sql`
      SELECT user_id FROM reseller_profiles WHERE id = ${id} LIMIT 1
    `);
    if (!profile.rows.length) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    await db.execute(sql`
      UPDATE reseller_profiles
      SET status = 'active', api_key = ${apiKey}, discount_slab_tier = ${discountTier ?? 1}
      WHERE id = ${id}
    `);

    const userId = profile.rows[0].user_id as string;
    await db.execute(sql`
      INSERT INTO reseller_funds (user_id, balance, currency)
      VALUES (${userId}, 0, 'USD')
      ON CONFLICT (user_id) DO NOTHING
    `);

    res.json({ success: true, apiKey });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Decline application ────────────────────────────────────────────────
router.put("/admin/resellers/:id/decline", authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(sql`
      UPDATE reseller_profiles SET status = 'suspended' WHERE id = ${id}
    `);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Get TLD pricing ────────────────────────────────────────────────────
router.get("/admin/resellers/pricing", authenticate, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT id, tld, retail_price, reseller_price FROM reseller_domain_pricing ORDER BY tld ASC
    `);
    res.json(rows.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Save TLD pricing ───────────────────────────────────────────────────
router.put("/admin/resellers/pricing", authenticate, requireAdmin, async (req, res) => {
  try {
    const items = req.body as Array<{
      tld: string; retailPrice: number; resellerPrice: number;
    }>;
    if (!Array.isArray(items)) {
      res.status(400).json({ error: "Expected array of pricing items" });
      return;
    }
    for (const item of items) {
      await db.execute(sql`
        INSERT INTO reseller_domain_pricing (tld, retail_price, reseller_price)
        VALUES (${item.tld}, ${item.retailPrice}, ${item.resellerPrice})
        ON CONFLICT (tld) DO UPDATE
          SET retail_price = ${item.retailPrice},
              reseller_price = ${item.resellerPrice}
      `);
    }
    res.json({ success: true, updated: items.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Adjust reseller balance ────────────────────────────────────────────
router.post("/admin/resellers/balance-adjust", authenticate, requireAdmin, async (req, res) => {
  try {
    const { email, amount, type, notes } = req.body as {
      email?: string; amount?: number; type?: string; notes?: string;
    };
    if (!email || !amount || !type) {
      res.status(400).json({ error: "email, amount, and type are required" });
      return;
    }
    const userRow = await db.execute(sql`
      SELECT id FROM users WHERE email = ${email.toLowerCase()} LIMIT 1
    `);
    if (!userRow.rows.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const userId = String(userRow.rows[0].id);
    const delta = type === "credit" ? Math.abs(amount) : -Math.abs(amount);

    await db.execute(sql`
      INSERT INTO reseller_funds (user_id, balance, currency)
      VALUES (${userId}, ${delta}, 'USD')
      ON CONFLICT (user_id) DO UPDATE
        SET balance = GREATEST(0, reseller_funds.balance + ${delta}),
            updated_at = NOW()
    `);

    await db.execute(sql`
      INSERT INTO reseller_transactions (user_id, type, amount, notes)
      VALUES (${userId}, ${type}, ${Math.abs(amount)}, ${notes ?? "Admin adjustment"})
    `);

    const updated = await db.execute(sql`SELECT balance FROM reseller_funds WHERE user_id = ${userId}`);
    res.json({ success: true, newBalance: updated.rows[0]?.balance });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
