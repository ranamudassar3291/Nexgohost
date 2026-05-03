/**
 * Page Manager CMS — site_pages table
 * Public:  GET /api/pages/:pageId
 * Admin:   GET  /api/admin/pages/:pageId
 *          PUT  /api/admin/pages/:pageId/:sectionName
 *          POST /api/admin/pages/:pageId/:sectionName/visibility
 */
import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { sitePagesTable } from "@workspace/db/schema";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

// ─── Ensure table exists (idempotent) ────────────────────────────────────────
async function ensureTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS site_pages (
        page_id      VARCHAR(50)  NOT NULL,
        section_name VARCHAR(100) NOT NULL,
        content_json TEXT,
        is_visible   BOOLEAN      NOT NULL DEFAULT TRUE,
        last_updated TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        PRIMARY KEY (page_id, section_name)
      )
    `);
  } catch (err) {
    console.error("[pages] ensureTable error:", err);
  }
}
ensureTable();

// ─── Default page content (seeded on first fetch if DB row missing) ───────────
const PAGE_DEFAULTS: Record<string, Record<string, { content: any; isVisible: boolean }>> = {
  home: {
    meta: {
      isVisible: true,
      content: {
        title: "Noehost — Next-Gen Web Hosting",
        description: "Experience next-gen hosting for creators, innovators and builders. Affordable web hosting with free SSL.",
        keywords: "web hosting, cheap hosting, vps, reseller, domains",
      },
    },
    hero: { isVisible: true, content: {} },
    services: { isVisible: true, content: {} },
    features: { isVisible: true, content: {} },
    pricing: { isVisible: true, content: {} },
    promo: { isVisible: true, content: {} },
    faq: { isVisible: true, content: {} },
    testimonials: { isVisible: true, content: {} },
    cta: { isVisible: true, content: {} },
  },
  about: {
    meta: {
      isVisible: true,
      content: {
        title: "About Us — Noehost",
        description: "Learn about Noehost, our mission, values, and the team behind Pakistan's growing hosting provider.",
        keywords: "about noehost, hosting company, web hosting pakistan",
      },
    },
    hero: {
      isVisible: true,
      content: {
        title: "About Noehost",
        subtitle: "Empowering businesses and creators with reliable, affordable hosting since day one.",
        badge: "Our Story",
      },
    },
    mission: {
      isVisible: true,
      content: {
        title: "Our Mission",
        description: "To make world-class hosting accessible to everyone — from indie developers to growing businesses — at prices that make sense.",
      },
    },
    values: {
      isVisible: true,
      content: {
        title: "Our Values",
        items: [
          { title: "Reliability", description: "99.9% uptime backed by enterprise infrastructure." },
          { title: "Transparency", description: "No hidden fees, no surprise charges." },
          { title: "Support", description: "Real humans available 24/7 to help you succeed." },
        ],
      },
    },
    team: {
      isVisible: true,
      content: {
        title: "The Team",
        description: "A passionate group of engineers, designers, and support specialists working to keep your business online.",
      },
    },
    contact: {
      isVisible: true,
      content: {
        title: "Get in Touch",
        email: "support@noehost.com",
        phone: "+92 300 0000000",
        address: "Lahore, Pakistan",
      },
    },
  },
  pricing: {
    meta: {
      isVisible: true,
      content: {
        title: "Web Hosting Plans & Pricing — Noehost",
        description: "Affordable shared hosting, VPS, reseller, and WordPress plans. All with free SSL and 24/7 support.",
        keywords: "hosting plans, pricing, cheap web hosting, vps plans",
      },
    },
    header: {
      isVisible: true,
      content: {
        title: "Choose Your Hosting Plan",
        subtitle: "All plans include a 30-day money-back guarantee, free SSL, and 24/7 support.",
        badge: "Best Value",
      },
    },
    cta: {
      isVisible: true,
      content: {
        title: "Not sure which plan?",
        description: "Our team is happy to help you choose the right plan for your needs.",
        buttonText: "Contact Us",
        buttonHref: "/contact-us",
      },
    },
  },
  terms: {
    meta: {
      isVisible: true,
      content: {
        title: "Terms of Service — Noehost",
        description: "Read Noehost's terms of service, acceptable use policy, and refund policy.",
        keywords: "terms of service, terms and conditions, hosting terms",
      },
    },
    header: {
      isVisible: true,
      content: {
        title: "Terms of Service",
        lastUpdated: "27 March 2026",
      },
    },
    content: {
      isVisible: true,
      content: {
        body: `By accessing or using Noehost's services, you agree to be bound by these Terms of Service.

## 1. Account Responsibility
You are responsible for maintaining the security of your account credentials. Any activities under your account are your responsibility. Notify us immediately of any unauthorized access.

## 2. Acceptable Use
You agree not to use our services for:
- Sending spam or unsolicited email
- Hosting malware, phishing pages, or illegal content
- Violating any applicable laws or regulations
- Overloading shared server resources

## 3. Payment & Billing
Services are billed in advance. Failure to pay may result in service suspension. Disputed charges must be reported within 30 days.

## 4. Refund Policy
Hosting plans include a 30-day money-back guarantee. Domain registrations are non-refundable. Renewal payments are non-refundable.

## 5. Service Availability
We target 99.9% uptime. Scheduled maintenance will be announced in advance. We are not liable for losses due to downtime beyond our control.

## 6. Termination
We reserve the right to suspend or terminate accounts that violate these terms without prior notice.

## 7. Changes
We may update these terms at any time. Continued use of our services constitutes acceptance of the revised terms.

## 8. Contact
For any questions: support@noehost.com`,
      },
    },
  },
  privacy: {
    meta: {
      isVisible: true,
      content: {
        title: "Privacy Policy — Noehost",
        description: "Learn how Noehost collects, uses, and protects your personal information.",
        keywords: "privacy policy, data protection, personal information",
      },
    },
    header: {
      isVisible: true,
      content: {
        title: "Privacy Policy",
        lastUpdated: "27 March 2026",
      },
    },
    content: {
      isVisible: true,
      content: {
        body: `At Noehost, we are committed to protecting your personal information.

## 1. Information We Collect
- Account information: name, email address, phone number, billing address
- Payment information: bank transfer references, transaction IDs (we do not store card numbers)
- Technical information: IP address, browser type, device information
- Domain WHOIS data required by domain registries
- Support communications: tickets and messages you send us

## 2. How We Use Your Information
- To provision and manage your hosting and domain services
- To process payments and send invoices
- To communicate service updates and renewal reminders
- To detect and prevent fraud and unauthorized access
- To comply with legal obligations

## 3. Data Sharing
We do not sell your personal data. We share data only with partners necessary to deliver our services (domain registries, payment processors, server providers).

## 4. Data Security
We use industry-standard encryption and security practices to protect your data.

## 5. Your Rights
You may request access to, correction of, or deletion of your personal data by contacting us at support@noehost.com.

## 6. Cookies
We use essential cookies for login sessions. No third-party tracking cookies are used.

## 7. Changes
We may update this policy. Continued use of our services constitutes acceptance of changes.

## 8. Contact
For privacy questions: support@noehost.com`,
      },
    },
  },
};

// Fetch all sections for a page, seeding defaults for missing ones
async function getPageSections(pageId: string, adminMode = false) {
  const rows = await db
    .select()
    .from(sitePagesTable)
    .where(eq(sitePagesTable.pageId, pageId));

  const stored = Object.fromEntries(rows.map((r) => [r.sectionName, r]));
  const defaults = PAGE_DEFAULTS[pageId] ?? {};

  const result: Record<string, { content: any; isVisible: boolean; lastUpdated: Date | null }> = {};

  for (const [section, def] of Object.entries(defaults)) {
    if (stored[section]) {
      const row = stored[section];
      let parsed = def.content;
      try { if (row.contentJson) parsed = JSON.parse(row.contentJson); } catch {}
      if (adminMode || row.isVisible) {
        result[section] = { content: parsed, isVisible: row.isVisible, lastUpdated: row.lastUpdated };
      }
    } else {
      // Seed into DB
      try {
        await db.insert(sitePagesTable).values({
          pageId,
          sectionName: section,
          contentJson: JSON.stringify(def.content),
          isVisible: def.isVisible,
        }).onConflictDoNothing();
      } catch {}
      if (adminMode || def.isVisible) {
        result[section] = { content: def.content, isVisible: def.isVisible, lastUpdated: null };
      }
    }
  }

  return result;
}

// ─── GET /api/pages/:pageId — public ──────────────────────────────────────────
router.get("/pages/:pageId", async (req, res) => {
  try {
    const { pageId } = req.params;
    const sections = await getPageSections(pageId, false);
    return res.json({ pageId, sections });
  } catch (err) {
    console.error("[pages] GET error:", err);
    return res.status(500).json({ error: "Failed to fetch page" });
  }
});

// ─── GET /api/admin/pages/:pageId — admin ─────────────────────────────────────
router.get("/admin/pages/:pageId", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { pageId } = req.params;
    const sections = await getPageSections(pageId, true);
    return res.json({ pageId, sections });
  } catch (err) {
    console.error("[pages] admin GET error:", err);
    return res.status(500).json({ error: "Failed to fetch page" });
  }
});

// ─── PUT /api/admin/pages/:pageId/:sectionName — admin ────────────────────────
router.put("/admin/pages/:pageId/:sectionName", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { pageId, sectionName } = req.params;
    const { content, isVisible } = req.body as { content?: any; isVisible?: boolean };

    const existing = await db
      .select()
      .from(sitePagesTable)
      .where(and(eq(sitePagesTable.pageId, pageId), eq(sitePagesTable.sectionName, sectionName)));

    const contentJson = content !== undefined ? JSON.stringify(content) : undefined;
    const defaults = PAGE_DEFAULTS[pageId]?.[sectionName];

    if (existing.length > 0) {
      await db
        .update(sitePagesTable)
        .set({
          ...(contentJson !== undefined ? { contentJson } : {}),
          ...(isVisible !== undefined ? { isVisible } : {}),
          lastUpdated: new Date(),
        })
        .where(and(eq(sitePagesTable.pageId, pageId), eq(sitePagesTable.sectionName, sectionName)));
    } else {
      await db.insert(sitePagesTable).values({
        pageId,
        sectionName,
        contentJson: contentJson ?? JSON.stringify(defaults?.content ?? {}),
        isVisible: isVisible ?? defaults?.isVisible ?? true,
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("[pages] PUT error:", err);
    return res.status(500).json({ error: "Failed to update section" });
  }
});

// ─── GET /api/admin/pages — list all pages ────────────────────────────────────
router.get("/admin/pages", authenticate, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const pages = Object.keys(PAGE_DEFAULTS);
    return res.json({ pages });
  } catch (err) {
    return res.status(500).json({ error: "Failed to list pages" });
  }
});

export default router;
