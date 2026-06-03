import { Router } from "express";
import { db } from "@workspace/db";
import { domainExtensionsTable, settingsTable } from "@workspace/db/schema";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { asc, eq } from "drizzle-orm";

const router = Router();

function formatExt(row: typeof domainExtensionsTable.$inferSelect) {
  return {
    id: row.id,
    extension: row.extension,
    registerPrice: row.registerPrice,
    register2YearPrice: row.register2YearPrice,
    register3YearPrice: row.register3YearPrice,
    renewalPrice: row.renewalPrice,
    renew2YearPrice: row.renew2YearPrice,
    renew3YearPrice: row.renew3YearPrice,
    transferPrice: row.transferPrice,
    privacyEnabled: row.privacyEnabled,
    isFreeWithHosting: row.isFreeWithHosting ?? false,
    transferAllowed: row.transferAllowed ?? true,
    sortOrder: row.sortOrder ?? 999,
    showInSuggestions: row.showInSuggestions ?? true,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// GET /api/admin/domain-extensions
router.get("/admin/domain-extensions", authenticate, requireAdmin, async (_req, res) => {
  const extensions = await db.select().from(domainExtensionsTable)
    .orderBy(asc(domainExtensionsTable.sortOrder), asc(domainExtensionsTable.extension));
  res.json(extensions.map(formatExt));
});

// GET /api/domain-extensions (public, active only)
router.get("/domain-extensions", async (_req, res) => {
  const extensions = await db.select().from(domainExtensionsTable)
    .where(eq(domainExtensionsTable.status, "active"))
    .orderBy(asc(domainExtensionsTable.sortOrder), asc(domainExtensionsTable.extension));
  res.json(extensions.map(formatExt));
});

// POST /api/admin/domain-extensions
router.post("/admin/domain-extensions", authenticate, requireAdmin, async (req, res) => {
  const { extension, registerPrice, register2YearPrice, register3YearPrice,
          renewalPrice, renew2YearPrice, renew3YearPrice, transferPrice,
          privacyEnabled, isFreeWithHosting, transferAllowed, status,
          sortOrder, showInSuggestions } = req.body;
  if (!extension || !registerPrice || !renewalPrice || !transferPrice) {
    return res.status(400).json({ error: "extension, registerPrice, renewalPrice, transferPrice are required" });
  }
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  try {
    const [record] = await db.insert(domainExtensionsTable).values({
      extension: ext.toLowerCase(),
      registerPrice: String(registerPrice),
      register2YearPrice: register2YearPrice ? String(register2YearPrice) : null,
      register3YearPrice: register3YearPrice ? String(register3YearPrice) : null,
      renewalPrice: String(renewalPrice),
      renew2YearPrice: renew2YearPrice ? String(renew2YearPrice) : null,
      renew3YearPrice: renew3YearPrice ? String(renew3YearPrice) : null,
      transferPrice: String(transferPrice),
      privacyEnabled: privacyEnabled !== undefined ? Boolean(privacyEnabled) : true,
      isFreeWithHosting: isFreeWithHosting !== undefined ? Boolean(isFreeWithHosting) : false,
      transferAllowed: transferAllowed !== undefined ? Boolean(transferAllowed) : true,
      sortOrder: sortOrder !== undefined ? Number(sortOrder) : 999,
      showInSuggestions: showInSuggestions !== undefined ? Boolean(showInSuggestions) : true,
      status: status || "active",
    }).returning();
    res.status(201).json(formatExt(record));
  } catch (err: any) {
    if (err.code === "23505") return res.status(400).json({ error: "Extension already exists" });
    throw err;
  }
});

// PUT /api/admin/domain-extensions/:id
router.put("/admin/domain-extensions/:id", authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { extension, registerPrice, register2YearPrice, register3YearPrice,
          renewalPrice, renew2YearPrice, renew3YearPrice, transferPrice,
          status, privacyEnabled, isFreeWithHosting, transferAllowed,
          sortOrder, showInSuggestions } = req.body;
  const updates: Record<string, unknown> = {};
  if (extension !== undefined) updates.extension = extension.startsWith(".") ? extension.toLowerCase() : `.${extension}`.toLowerCase();
  if (registerPrice !== undefined) updates.registerPrice = String(registerPrice);
  if (register2YearPrice !== undefined) updates.register2YearPrice = register2YearPrice ? String(register2YearPrice) : null;
  if (register3YearPrice !== undefined) updates.register3YearPrice = register3YearPrice ? String(register3YearPrice) : null;
  if (renewalPrice !== undefined) updates.renewalPrice = String(renewalPrice);
  if (renew2YearPrice !== undefined) updates.renew2YearPrice = renew2YearPrice ? String(renew2YearPrice) : null;
  if (renew3YearPrice !== undefined) updates.renew3YearPrice = renew3YearPrice ? String(renew3YearPrice) : null;
  if (transferPrice !== undefined) updates.transferPrice = String(transferPrice);
  if (status !== undefined) updates.status = status;
  if (privacyEnabled !== undefined) updates.privacyEnabled = Boolean(privacyEnabled);
  if (isFreeWithHosting !== undefined) updates.isFreeWithHosting = Boolean(isFreeWithHosting);
  if (transferAllowed !== undefined) updates.transferAllowed = Boolean(transferAllowed);
  if (sortOrder !== undefined) updates.sortOrder = Number(sortOrder);
  if (showInSuggestions !== undefined) updates.showInSuggestions = Boolean(showInSuggestions);
  updates.updatedAt = new Date();
  const [record] = await db.update(domainExtensionsTable).set(updates).where(eq(domainExtensionsTable.id, id)).returning();
  if (!record) return res.status(404).json({ error: "Not found" });
  res.json(formatExt(record));
});

// DELETE /api/admin/domain-extensions/:id
router.delete("/admin/domain-extensions/:id", authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  await db.delete(domainExtensionsTable).where(eq(domainExtensionsTable.id, id));
  res.json({ success: true });
});

// ── Domain Bundle Manager ──────────────────────────────────────────────────────
const BUNDLE_KEY = "domain_bundles_v1";

const DEFAULT_BUNDLES: Record<string, string[]> = {
  ".com":    [".net", ".org", ".store", ".io"],
  ".net":    [".com", ".org", ".io"],
  ".org":    [".com", ".net"],
  ".pk":     [".com.pk", ".net.pk", ".com"],
  ".com.pk": [".pk", ".net.pk"],
};

async function getBundles(): Promise<Record<string, string[]>> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, BUNDLE_KEY)).limit(1);
  if (!row) return DEFAULT_BUNDLES;
  try { return JSON.parse(row.value as string); } catch { return DEFAULT_BUNDLES; }
}

// GET /api/domain-bundles — public
router.get("/domain-bundles", async (_req, res) => {
  res.json(await getBundles());
});

// GET /api/admin/domain-bundles — admin
router.get("/admin/domain-bundles", authenticate, requireAdmin, async (_req, res) => {
  res.json(await getBundles());
});

// PUT /api/admin/domain-bundles — admin save
router.put("/admin/domain-bundles", authenticate, requireAdmin, async (req, res) => {
  const bundles = req.body as Record<string, string[]>;
  if (!bundles || typeof bundles !== "object") {
    res.status(400).json({ error: "Invalid bundle config" });
    return;
  }
  const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, BUNDLE_KEY)).limit(1);
  const value = JSON.stringify(bundles);
  if (existing) {
    await db.update(settingsTable).set({ value } as any).where(eq(settingsTable.key, BUNDLE_KEY));
  } else {
    await db.insert(settingsTable).values({ key: BUNDLE_KEY, value } as any);
  }
  res.json({ success: true, bundles });
});

// ── Ionos-Style Bundle Pricing Config ──────────────────────────────────────
const BUNDLE_PRICING_KEY = "domain_bundle_pricing_v1";

interface BundlePricingEntry {
  tld: string;
  price: number;
  isFree: boolean;
  isEnabled: boolean;
}

const DEFAULT_BUNDLE_PRICING: BundlePricingEntry[] = [
  { tld: ".store",  price: 599,  isFree: false, isEnabled: true },
  { tld: ".online", price: 299,  isFree: false, isEnabled: true },
  { tld: ".co.uk",  price: 1299, isFree: false, isEnabled: true },
  { tld: ".net",    price: 1799, isFree: false, isEnabled: true },
  { tld: ".org",    price: 1499, isFree: false, isEnabled: true },
  { tld: ".info",   price: 699,  isFree: false, isEnabled: false },
  { tld: ".biz",    price: 799,  isFree: false, isEnabled: false },
  { tld: ".io",     price: 3499, isFree: false, isEnabled: false },
];

async function getBundlePricing(): Promise<BundlePricingEntry[]> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, BUNDLE_PRICING_KEY)).limit(1);
  if (!row) return DEFAULT_BUNDLE_PRICING;
  try { return JSON.parse(row.value as string); } catch { return DEFAULT_BUNDLE_PRICING; }
}

// GET /api/domain-bundle-pricing — public (only enabled)
router.get("/domain-bundle-pricing", async (_req, res) => {
  const config = await getBundlePricing();
  res.json(config.filter(e => e.isEnabled));
});

// GET /api/admin/domain-bundle-pricing — admin (all entries)
router.get("/admin/domain-bundle-pricing", authenticate, requireAdmin, async (_req, res) => {
  res.json(await getBundlePricing());
});

// PUT /api/admin/domain-bundle-pricing — admin save
router.put("/admin/domain-bundle-pricing", authenticate, requireAdmin, async (req, res) => {
  const config = req.body as BundlePricingEntry[];
  if (!Array.isArray(config)) { res.status(400).json({ error: "Expected array" }); return; }
  const value = JSON.stringify(config);
  const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, BUNDLE_PRICING_KEY)).limit(1);
  if (existing) {
    await db.update(settingsTable).set({ value } as any).where(eq(settingsTable.key, BUNDLE_PRICING_KEY));
  } else {
    await db.insert(settingsTable).values({ key: BUNDLE_PRICING_KEY, value } as any);
  }
  res.json({ success: true });
});

// POST /api/admin/domain-bundle-pricing/add — add one entry
router.post("/admin/domain-bundle-pricing/add", authenticate, requireAdmin, async (req, res) => {
  const { tld, price, isFree } = req.body as { tld: string; price: number; isFree: boolean };
  if (!tld) { res.status(400).json({ error: "TLD required" }); return; }
  const config = await getBundlePricing();
  const normalized = tld.trim().toLowerCase().startsWith(".") ? tld.trim().toLowerCase() : "." + tld.trim().toLowerCase();
  if (config.find(e => e.tld === normalized)) { res.status(409).json({ error: "TLD already exists" }); return; }
  config.push({ tld: normalized, price: Number(price) || 0, isFree: !!isFree, isEnabled: true });
  const value = JSON.stringify(config);
  const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, BUNDLE_PRICING_KEY)).limit(1);
  if (existing) await db.update(settingsTable).set({ value } as any).where(eq(settingsTable.key, BUNDLE_PRICING_KEY));
  else await db.insert(settingsTable).values({ key: BUNDLE_PRICING_KEY, value } as any);
  res.json({ success: true, config });
});

export default router;
