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
    badge: "Next-Gen Hosting Infrastructure",
    title: "Empower Your Digital Future with Noehost",
    description:
      "Experience next-gen hosting for creators, innovators and builders. The ultimate hosting platform for developers to start, launch, and scale big.",
    startingPrice: 1.99,
    features: [
      "Unlimited Storage",
      "Free SSL Certificates",
      "24/7 Expert Support",
      "Daily Rollout Notifications",
    ],
    ctaPrimary: "Get Started",
    ctaPrimaryHref: "/shared-hosting",
    showCtaPrimary: true,
    showCtaSecondary: false,
  },
  navbar: {
    logo: "NOEHOST",
    logoUrl: "",
    logoImage: "",
    links: [
      { name: "Home", href: "/", icon: "Home", color: "text-primary" },
      { name: "Shared", href: "/shared-hosting", icon: "Server", color: "text-blue-500" },
      { name: "VPS", href: "/vps-hosting", icon: "Cpu", color: "text-purple-500" },
      { name: "Reseller", href: "/reseller-hosting", icon: "Users", color: "text-rose-500" },
      { name: "WordPress", href: "/wordpress-hosting", icon: "Layout", color: "text-emerald-500" },
      { name: "Domains", href: "/domains", icon: "Globe", color: "text-cyan-500" },
      { name: "About", href: "/about-us", icon: "Info", color: "text-sky-500" },
      { name: "Contact", href: "/contact-us", icon: "Mail", color: "text-teal-500" },
    ],
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
      // For arrays: only use the override if it has items (non-empty).
      // An empty array in stored content should fall back to defaults.
      Array.isArray(overrides[key])
    ) {
      result[key] = overrides[key].length > 0 ? overrides[key] : (defaults[key] ?? overrides[key]);
    } else if (
      typeof overrides[key] === "object" &&
      overrides[key] !== null &&
      typeof defaults[key] === "object" &&
      defaults[key] !== null
    ) {
      result[key] = deepMerge(defaults[key], overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

export default router;
