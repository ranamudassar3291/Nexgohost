import { Router } from "express";
import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { getAppUrl, getClientUrl } from "../lib/app-url.js";
import { authenticate, requireAdmin } from "../lib/auth.js";

const router = Router();

const CONFIG_KEYS = [
  "panel_url", "cart_url", "admin_panel_url",
  "site_name", "site_tagline",
  "branding_logo", "branding_favicon",
  "brand_primary_color", "brand_website", "brand_whatsapp",
  "brand_address", "brand_support_email",
  "brand_social_twitter", "brand_social_facebook", "brand_social_linkedin",
  "invoice_footer_text",
];

// GET /api/config — public endpoint (no auth required)
router.get("/config", async (_req, res) => {
  try {
    const rows = await db.select().from(settingsTable).where(inArray(settingsTable.key, CONFIG_KEYS));
    const s: Record<string, string> = {};
    for (const r of rows) s[r.key] = r.value ?? "";

    const appUrl = getAppUrl();
    const clientUrl = getClientUrl();
    const panel = s["panel_url"] || clientUrl;
    const cart  = s["cart_url"]  || `${clientUrl}/orders/new`;

    res.json({
      panelUrl:     panel,
      cartUrl:      cart,
      adminUrl:     s["admin_panel_url"]  || `${appUrl}/admin`,
      siteName:     s["site_name"]        || "Noehost",
      siteTagline:  s["site_tagline"]     || "Professional Hosting Solutions",
      loginUrl:     `${panel}/login`,
      registerUrl:  `${panel}/register`,
      dashboardUrl: `${panel}/dashboard`,
      checkoutUrl:  cart,
      logoUrl:      s["branding_logo"]    || null,
      faviconUrl:   s["branding_favicon"] || null,
      primaryColor:        s["brand_primary_color"]   || "#701AFE",
      brandWebsite:        s["brand_website"]          || "",
      brandWhatsapp:       s["brand_whatsapp"]         || "",
      brandAddress:        s["brand_address"]          || "",
      brandSupportEmail:   s["brand_support_email"]    || "",
      brandSocialTwitter:  s["brand_social_twitter"]   || "",
      brandSocialFacebook: s["brand_social_facebook"]  || "",
      brandSocialLinkedin: s["brand_social_linkedin"]  || "",
      invoiceFooterText:   s["invoice_footer_text"]    || "",
    });
  } catch {
    const clientUrl = getClientUrl();
    const appUrl = getAppUrl();
    res.json({
      panelUrl:     clientUrl,
      cartUrl:      `${clientUrl}/orders/new`,
      adminUrl:     `${appUrl}/admin`,
      siteName:     "Noehost",
      siteTagline:  "Professional Hosting Solutions",
      loginUrl:     `${clientUrl}/login`,
      registerUrl:  `${clientUrl}/register`,
      dashboardUrl: `${clientUrl}/dashboard`,
      checkoutUrl:  `${clientUrl}/orders/new`,
      logoUrl:      null,
      faviconUrl:   null,
    });
  }
});

// PUT /api/admin/config — update configurable panel URLs (admin only)
router.put("/admin/config", authenticate, requireAdmin, async (req, res) => {
  const allowed = new Set(CONFIG_KEYS);
  const updates = req.body as Record<string, string>;
  try {
    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.has(key)) continue;
      const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
      if (existing) {
        await db.update(settingsTable).set({ value: String(value), updatedAt: new Date() }).where(eq(settingsTable.key, key));
      } else {
        await db.insert(settingsTable).values({ key, value: String(value), updatedAt: new Date() }).onConflictDoNothing();
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
