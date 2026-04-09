/**
 * Public site content — editable via admin CMS.
 * Stored as JSON blobs in settingsTable, one row per content key.
 */
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

const CONTENT_SETTING_KEY = "site_content_v1";

// Default content served when the DB has no customisations yet
const DEFAULT_CONTENT = {
  hero: {
    badge: "Special Offer: Save 75% Today",
    title: "Everything you need to create a website",
    description:
      "Free SSL, one-year free domain, 99.9% uptime, easy WordPress. Explore Our Services.",
    startingPrice: 1.99,
    features: [
      "Free Domain for 1st Year",
      "Free Website Migration",
      "24/7 Customer Support",
      "30-Day Money-Back Guarantee",
    ],
    ctaPrimary: "Get Started",
    ctaPrimaryHref: "/order",
    showCtaPrimary: true,
    showCtaSecondary: false,
  },
  navbar: {
    logo: "NOEHOST",
    logoUrl: "",
    logoImage: "",
    links: [],
  },
  config: {
    topbar: {
      show: true,
      email: "support@noehost.com",
      phone: "+92 300 0000000",
      announcement: "Flash Sale: 50% Off all Shared Plans!",
    },
  },
};

// ── GET /api/content — public ─────────────────────────────────────────────────
router.get("/content", async (_req, res) => {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, CONTENT_SETTING_KEY));

    if (!row?.value) {
      return res.json(DEFAULT_CONTENT);
    }

    try {
      const parsed = JSON.parse(row.value);
      // Deep merge: defaults fill in any keys missing from stored content
      const merged = deepMerge(DEFAULT_CONTENT, parsed);
      return res.json(merged);
    } catch {
      return res.json(DEFAULT_CONTENT);
    }
  } catch (err) {
    console.error("[content] GET /api/content error:", err);
    return res.json(DEFAULT_CONTENT);
  }
});

// ── POST /api/admin/content — admin only ──────────────────────────────────────
router.post(
  "/admin/content",
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { key, value } = req.body as { key: string; value: any };
      if (!key) return res.status(400).json({ error: "key is required" });

      // Load current content
      const [row] = await db
        .select()
        .from(settingsTable)
        .where(eq(settingsTable.key, CONTENT_SETTING_KEY));

      let current: Record<string, any> = {};
      if (row?.value) {
        try { current = JSON.parse(row.value); } catch {}
      }

      // Update the specific key
      current[key] = value;
      const newValue = JSON.stringify(current);

      if (row) {
        await db
          .update(settingsTable)
          .set({ value: newValue })
          .where(eq(settingsTable.key, CONTENT_SETTING_KEY));
      } else {
        await db.insert(settingsTable).values({
          key: CONTENT_SETTING_KEY,
          value: newValue,
        });
      }

      return res.json({ success: true });
    } catch (err) {
      console.error("[content] POST /api/admin/content error:", err);
      return res.status(500).json({ error: "Failed to update content" });
    }
  }
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function deepMerge(defaults: any, overrides: any): any {
  if (
    typeof defaults !== "object" ||
    defaults === null ||
    typeof overrides !== "object" ||
    overrides === null
  ) {
    return overrides !== undefined ? overrides : defaults;
  }
  const result: any = { ...defaults };
  for (const key of Object.keys(overrides)) {
    if (
      typeof overrides[key] === "object" &&
      overrides[key] !== null &&
      !Array.isArray(overrides[key]) &&
      typeof defaults[key] === "object" &&
      defaults[key] !== null &&
      !Array.isArray(defaults[key])
    ) {
      result[key] = deepMerge(defaults[key], overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

export default router;
