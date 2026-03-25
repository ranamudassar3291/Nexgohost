import { Router } from "express";
import { db } from "@workspace/db";
import { kbCategoriesTable, kbArticlesTable } from "@workspace/db/schema";
import { eq, ilike, or, and, desc, asc, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../lib/auth.js";

const router = Router();

// ─── Slug helpers ─────────────────────────────────────────────────────────────
function toSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ─── PUBLIC: list published categories (with article count) ──────────────────
router.get("/kb/categories", async (_req, res) => {
  try {
    const categories = await db
      .select()
      .from(kbCategoriesTable)
      .where(eq(kbCategoriesTable.isPublished, true))
      .orderBy(asc(kbCategoriesTable.sortOrder), asc(kbCategoriesTable.name));

    const counts = await db
      .select({
        categoryId: kbArticlesTable.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(kbArticlesTable)
      .where(eq(kbArticlesTable.isPublished, true))
      .groupBy(kbArticlesTable.categoryId);

    const countMap: Record<string, number> = {};
    for (const c of counts) countMap[c.categoryId] = c.count;

    res.json(categories.map(cat => ({ ...cat, articleCount: countMap[cat.id] ?? 0 })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// ─── PUBLIC: list published articles (with optional search + category filter) ─
router.get("/kb/articles", async (req, res) => {
  try {
    const { q, categoryId, featured } = req.query as Record<string, string>;

    const articles = await db
      .select({
        id: kbArticlesTable.id,
        categoryId: kbArticlesTable.categoryId,
        title: kbArticlesTable.title,
        titleUr: kbArticlesTable.titleUr,
        titleAr: kbArticlesTable.titleAr,
        slug: kbArticlesTable.slug,
        excerpt: kbArticlesTable.excerpt,
        excerptUr: kbArticlesTable.excerptUr,
        excerptAr: kbArticlesTable.excerptAr,
        isFeatured: kbArticlesTable.isFeatured,
        views: kbArticlesTable.views,
        helpfulYes: kbArticlesTable.helpfulYes,
        helpfulNo: kbArticlesTable.helpfulNo,
        createdAt: kbArticlesTable.createdAt,
        updatedAt: kbArticlesTable.updatedAt,
      })
      .from(kbArticlesTable)
      .where(
        and(
          eq(kbArticlesTable.isPublished, true),
          q ? or(
            ilike(kbArticlesTable.title, `%${q}%`),
            ilike(kbArticlesTable.excerpt, `%${q}%`),
            ilike(kbArticlesTable.content, `%${q}%`)
          ) : undefined,
          categoryId ? eq(kbArticlesTable.categoryId, categoryId) : undefined,
          featured === "true" ? eq(kbArticlesTable.isFeatured, true) : undefined,
        )
      )
      .orderBy(desc(kbArticlesTable.isFeatured), desc(kbArticlesTable.updatedAt));

    res.json(articles);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

// ─── PUBLIC: get single article by slug ──────────────────────────────────────
router.get("/kb/articles/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const [article] = await db
      .select()
      .from(kbArticlesTable)
      .where(eq(kbArticlesTable.slug, slug))
      .limit(1);

    if (!article || !article.isPublished) return res.status(404).json({ error: "Article not found" });

    // increment views
    await db
      .update(kbArticlesTable)
      .set({ views: article.views + 1 })
      .where(eq(kbArticlesTable.id, article.id));

    const [category] = await db
      .select()
      .from(kbCategoriesTable)
      .where(eq(kbCategoriesTable.id, article.categoryId))
      .limit(1);

    // related articles in same category
    const related = await db
      .select({
        id: kbArticlesTable.id,
        title: kbArticlesTable.title,
        titleUr: kbArticlesTable.titleUr,
        titleAr: kbArticlesTable.titleAr,
        slug: kbArticlesTable.slug,
        excerpt: kbArticlesTable.excerpt,
      })
      .from(kbArticlesTable)
      .where(and(
        eq(kbArticlesTable.categoryId, article.categoryId),
        eq(kbArticlesTable.isPublished, true),
      ))
      .limit(5);

    res.json({ ...article, views: article.views + 1, category, related: related.filter(r => r.id !== article.id) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

// ─── PUBLIC: submit feedback ──────────────────────────────────────────────────
router.post("/kb/articles/:id/feedback", async (req, res) => {
  try {
    const { id } = req.params;
    const { helpful } = req.body as { helpful: boolean };

    const [article] = await db
      .select()
      .from(kbArticlesTable)
      .where(eq(kbArticlesTable.id, id))
      .limit(1);

    if (!article) return res.status(404).json({ error: "Article not found" });

    await db
      .update(kbArticlesTable)
      .set(
        helpful
          ? { helpfulYes: article.helpfulYes + 1 }
          : { helpfulNo: article.helpfulNo + 1 }
      )
      .where(eq(kbArticlesTable.id, id));

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

// ─── ADMIN: list all categories ───────────────────────────────────────────────
router.get("/admin/kb/categories", authenticate, requireRole("admin"), async (_req, res) => {
  try {
    const categories = await db
      .select()
      .from(kbCategoriesTable)
      .orderBy(asc(kbCategoriesTable.sortOrder), asc(kbCategoriesTable.name));

    const counts = await db
      .select({
        categoryId: kbArticlesTable.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(kbArticlesTable)
      .groupBy(kbArticlesTable.categoryId);

    const countMap: Record<string, number> = {};
    for (const c of counts) countMap[c.categoryId] = c.count;

    res.json(categories.map(cat => ({ ...cat, articleCount: countMap[cat.id] ?? 0 })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// ─── ADMIN: create category ───────────────────────────────────────────────────
router.post("/admin/kb/categories", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { name, description, icon, sortOrder, isPublished } = req.body;
    const slug = toSlug(name);

    const [cat] = await db
      .insert(kbCategoriesTable)
      .values({ name, slug, description, icon: icon || "BookOpen", sortOrder: sortOrder ?? 0, isPublished: isPublished ?? true })
      .returning();

    res.status(201).json(cat);
  } catch (e: any) {
    if (e?.code === "23505") return res.status(400).json({ error: "A category with this name already exists" });
    console.error(e);
    res.status(500).json({ error: "Failed to create category" });
  }
});

// ─── ADMIN: update category ───────────────────────────────────────────────────
router.put("/admin/kb/categories/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, sortOrder, isPublished } = req.body;

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) { updates.name = name; updates.slug = toSlug(name); }
    if (description !== undefined) updates.description = description;
    if (icon !== undefined) updates.icon = icon;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (isPublished !== undefined) updates.isPublished = isPublished;

    const [cat] = await db
      .update(kbCategoriesTable)
      .set(updates)
      .where(eq(kbCategoriesTable.id, id))
      .returning();

    if (!cat) return res.status(404).json({ error: "Category not found" });
    res.json(cat);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update category" });
  }
});

// ─── ADMIN: delete category ───────────────────────────────────────────────────
router.delete("/admin/kb/categories/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(kbCategoriesTable).where(eq(kbCategoriesTable.id, id));
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

// ─── ADMIN: list all articles ─────────────────────────────────────────────────
router.get("/admin/kb/articles", authenticate, requireRole("admin"), async (_req, res) => {
  try {
    const articles = await db
      .select()
      .from(kbArticlesTable)
      .orderBy(desc(kbArticlesTable.updatedAt));
    res.json(articles);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

// ─── ADMIN: get single article by ID ─────────────────────────────────────────
router.get("/admin/kb/articles/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const [article] = await db
      .select()
      .from(kbArticlesTable)
      .where(eq(kbArticlesTable.id, id))
      .limit(1);
    if (!article) return res.status(404).json({ error: "Article not found" });
    res.json(article);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

// ─── ADMIN: create article ────────────────────────────────────────────────────
router.post("/admin/kb/articles", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { categoryId, title, content, excerpt, seoTitle, seoDescription, isFeatured, isPublished } = req.body;
    const slug = toSlug(title);

    const [article] = await db
      .insert(kbArticlesTable)
      .values({
        categoryId, title, slug,
        content: content || "",
        excerpt, seoTitle, seoDescription,
        isFeatured: isFeatured ?? false,
        isPublished: isPublished ?? true,
      })
      .returning();

    res.status(201).json(article);
  } catch (e: any) {
    if (e?.code === "23505") return res.status(400).json({ error: "An article with this title already exists" });
    console.error(e);
    res.status(500).json({ error: "Failed to create article" });
  }
});

// ─── ADMIN: update article ────────────────────────────────────────────────────
router.put("/admin/kb/articles/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryId, title, content, excerpt, seoTitle, seoDescription, isFeatured, isPublished } = req.body;

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (categoryId !== undefined) updates.categoryId = categoryId;
    if (title !== undefined) { updates.title = title; updates.slug = toSlug(title); }
    if (content !== undefined) updates.content = content;
    if (excerpt !== undefined) updates.excerpt = excerpt;
    if (seoTitle !== undefined) updates.seoTitle = seoTitle;
    if (seoDescription !== undefined) updates.seoDescription = seoDescription;
    if (isFeatured !== undefined) updates.isFeatured = isFeatured;
    if (isPublished !== undefined) updates.isPublished = isPublished;

    const [article] = await db
      .update(kbArticlesTable)
      .set(updates)
      .where(eq(kbArticlesTable.id, id))
      .returning();

    if (!article) return res.status(404).json({ error: "Article not found" });
    res.json(article);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update article" });
  }
});

// ─── ADMIN: delete article ────────────────────────────────────────────────────
router.delete("/admin/kb/articles/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(kbArticlesTable).where(eq(kbArticlesTable.id, id));
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete article" });
  }
});

// ─── ADMIN: trigger seed ──────────────────────────────────────────────────────
router.post("/admin/kb/seed", authenticate, requireRole("admin"), async (_req, res) => {
  try {
    await seedKbContent();
    res.json({ ok: true, message: "Knowledge base seeded successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to seed knowledge base" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SEED FUNCTION — 22 professional Noehost articles across 6 categories
// Runs on startup; detects v2 content by slug; force-reseeds if on old content
// ─────────────────────────────────────────────────────────────────────────────

const SS = (caption: string) =>
  `<div class="kb-screenshot"><div class="kb-screenshot-inner">` +
  `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:2.5rem;height:2.5rem;opacity:0.45">` +
  `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>` +
  `</svg><span class="kb-screenshot-tag">Screenshot</span><p class="kb-screenshot-caption">${caption}</p></div></div>`;

export async function seedKbContent() {
  // Check if v3 content already exists (v3 adds Troubleshooting category + 404/500/DNS articles)
  const [v3Check] = await db
    .select()
    .from(kbArticlesTable)
    .where(eq(kbArticlesTable.slug, "fixing-404-not-found-errors-noehost"))
    .limit(1);

  if (v3Check) return; // already on v3

  // Clear old content
  await db.delete(kbCategoriesTable); // cascades to articles

  const categories = [
    {
      name: "Getting Started",
      nameUr: "شروعات",
      nameAr: "البدء",
      slug: "getting-started",
      description: "New to Noehost? Start here — everything you need to get online fast.",
      descriptionUr: "Noehost پر نئے ہیں؟ یہاں سے شروع کریں۔",
      descriptionAr: "جديد على Noehost؟ ابدأ من هنا.",
      icon: "Rocket",
      sortOrder: 1,
    },
    {
      name: "cPanel & Technical",
      nameUr: "cPanel اور تکنیکی",
      nameAr: "cPanel والتقني",
      slug: "cpanel-technical",
      description: "Manage your hosting, files, email, and server settings via cPanel.",
      descriptionUr: "cPanel کے ذریعے ہوسٹنگ اور فائلیں مینیج کریں۔",
      descriptionAr: "إدارة الاستضافة والملفات والبريد عبر cPanel.",
      icon: "Server",
      sortOrder: 2,
    },
    {
      name: "WordPress Special",
      nameUr: "ورڈپریس خاص",
      nameAr: "ووردبريس",
      slug: "wordpress-special",
      description: "Install, configure, and troubleshoot WordPress on Noehost.",
      descriptionUr: "Noehost پر WordPress انسٹال اور مینیج کریں۔",
      descriptionAr: "تثبيت WordPress وإدارته على Noehost.",
      icon: "Zap",
      sortOrder: 3,
    },
    {
      name: "Domains & Billing",
      nameUr: "ڈومین اور بلنگ",
      nameAr: "النطاقات والفوترة",
      slug: "domains-billing",
      description: "Domain registration, nameservers, invoices, and renewals.",
      descriptionUr: "ڈومین رجسٹریشن، نیم سرور، انوائس اور تجدید۔",
      descriptionAr: "تسجيل النطاقات وخوادم الأسماء والفواتير والتجديد.",
      icon: "CreditCard",
      sortOrder: 4,
    },
    {
      name: "Account & Security",
      nameUr: "اکاؤنٹ اور سیکیورٹی",
      nameAr: "الحساب والأمان",
      slug: "account-security",
      description: "Password, profile, two-factor auth, and account management.",
      descriptionUr: "پاس ورڈ، پروفائل اور اکاؤنٹ سیکیورٹی سیٹنگز۔",
      descriptionAr: "كلمة المرور والملف الشخصي وإدارة الحساب.",
      icon: "Shield",
      sortOrder: 5,
    },
    {
      name: "Email & DNS",
      nameUr: "ای میل اور DNS",
      nameAr: "البريد الإلكتروني و DNS",
      slug: "email-dns",
      description: "Set up professional email, DNS records, SPF, DKIM, and more.",
      descriptionUr: "پروفیشنل ای میل، DNS ریکارڈز اور DKIM سیٹ اپ کریں۔",
      descriptionAr: "إعداد البريد الإلكتروني وسجلات DNS و DKIM.",
      icon: "Mail",
      sortOrder: 6,
    },
    {
      name: "Troubleshooting",
      nameUr: "مسائل کا حل",
      nameAr: "استكشاف الأخطاء",
      slug: "troubleshooting",
      description: "Fix common website errors like 404, 500, DNS issues, and database connection problems.",
      descriptionUr: "عام ویب سائٹ غلطیاں جیسے 404، 500، DNS اور ڈیٹا بیس مسائل حل کریں۔",
      descriptionAr: "إصلاح أخطاء الموقع الشائعة مثل 404 و500 ومشاكل DNS وقاعدة البيانات.",
      icon: "AlertTriangle",
      sortOrder: 7,
    },
  ];

  const insertedCats = await db.insert(kbCategoriesTable).values(categories).returning();
  const catMap: Record<string, string> = {};
  for (const cat of insertedCats) catMap[cat.slug] = cat.id;

  const articles = [

    // ── GETTING STARTED ─────────────────────────────────────────────────────
    {
      categoryId: catMap["getting-started"],
      title: "Welcome to Noehost: Your First 5 Steps After Buying Hosting",
      titleUr: "Noehost میں خوش آمدید: ہوسٹنگ خریدنے کے بعد 5 پہلے قدم",
      titleAr: "مرحباً بك في Noehost: أول 5 خطوات بعد شراء الاستضافة",
      slug: "welcome-to-noehost-first-5-steps",
      excerpt: "A complete checklist to get your Noehost hosting account live in under 30 minutes.",
      excerptUr: "Noehost ہوسٹنگ کو 30 منٹ میں فعال کرنے کی مکمل چیک لسٹ۔",
      excerptAr: "قائمة تحقق كاملة لتشغيل استضافتك على Noehost في أقل من 30 دقيقة.",
      seoTitle: "Getting Started with Noehost Hosting — First 5 Steps | Noehost Help",
      seoDescription: "New to Noehost? Follow our step-by-step guide to activate your hosting, access cPanel, upload your website, and go live in minutes.",
      isFeatured: true,
      content: `<h2>Congratulations on Choosing Noehost!</h2>
<p>You've made a great decision. Noehost delivers fast, reliable Pakistani hosting with 24/7 support. This guide walks you through the exact 5 steps to get your website live quickly.</p>

<h2>Step 1 — Check Your Welcome Email</h2>
<p>Within a few minutes of payment confirmation, Noehost sends you a <strong>Welcome Email</strong> containing:</p>
<ul>
  <li>Your cPanel username and temporary password</li>
  <li>Your cPanel login URL (e.g., <code>https://yourdomain.com:2083</code>)</li>
  <li>Your nameservers: <code>ns1.noehost.com</code> and <code>ns2.noehost.com</code></li>
  <li>Your hosting server IP address</li>
</ul>
<p>Check your spam folder if you don't see it within 10 minutes.</p>
${SS("Noehost Welcome Email showing cPanel credentials and nameservers")}

<h2>Step 2 — Log In to Your Client Area</h2>
<p>Go to <a href="https://noehost.com">noehost.com</a> and click <strong>Client Login</strong>. Use the email and password you chose when ordering.</p>
${SS("Noehost Client Area login page")}

<h2>Step 3 — Update Your Domain's Nameservers</h2>
<p>If your domain is registered elsewhere (GoDaddy, Namecheap, etc.), you need to point it to Noehost:</p>
<ol>
  <li>Log in to your domain registrar</li>
  <li>Find DNS or Nameserver settings</li>
  <li>Set: <strong>NS1: ns1.noehost.com</strong> and <strong>NS2: ns2.noehost.com</strong></li>
  <li>Save — DNS propagation takes 2–24 hours</li>
</ol>
${SS("Domain registrar nameserver update page — enter ns1.noehost.com and ns2.noehost.com")}

<h2>Step 4 — Access cPanel</h2>
<p>From your Client Area, go to <strong>Services → Your Hosting Plan → Login to cPanel</strong>. This logs you in automatically.</p>
${SS("Noehost Client Area — Services panel with Login to cPanel button")}

<h2>Step 5 — Upload Your Website or Install WordPress</h2>
<p>You're ready to go! Now you can:</p>
<ul>
  <li><strong>Upload a website</strong> — Use cPanel File Manager → <code>public_html</code></li>
  <li><strong>Install WordPress</strong> — Use Softaculous in cPanel (1-click install)</li>
  <li><strong>Create an email</strong> — cPanel → Email Accounts</li>
</ul>
<p>If you get stuck at any step, open a support ticket from your Client Area and our team will help immediately.</p>`,
    },

    {
      categoryId: catMap["getting-started"],
      title: "How to Access Your Client Area and Manage Your Services",
      titleUr: "کلائنٹ ایریا تک کیسے پہنچیں اور سروسز مینیج کریں",
      titleAr: "كيفية الوصول إلى منطقة العميل وإدارة خدماتك",
      slug: "how-to-access-client-area-manage-services",
      excerpt: "Learn every section of the Noehost Client Area — services, invoices, tickets, and more.",
      excerptUr: "Noehost کلائنٹ ایریا کا ہر حصہ سیکھیں — سروسز، انوائس، ٹکٹ وغیرہ۔",
      excerptAr: "تعرف على كل قسم في منطقة عميل Noehost — الخدمات والفواتير وتذاكر الدعم.",
      seoTitle: "Noehost Client Area Guide — Manage Services, Invoices & Tickets",
      seoDescription: "Complete guide to the Noehost client portal. Learn how to manage hosting services, pay invoices, open support tickets, and update your account.",
      isFeatured: true,
      content: `<h2>What Is the Client Area?</h2>
<p>The <strong>Client Area</strong> is your personal control hub at Noehost. Every service, invoice, domain, and support ticket is managed from here. Access it at <a href="https://noehost.com/client">noehost.com/client</a>.</p>
${SS("Noehost Client Area dashboard overview")}

<h2>Key Sections Explained</h2>

<h3>Dashboard</h3>
<p>The main overview showing active services, unpaid invoices, recent tickets, and quick-action buttons. You'll see your account balance and any alerts here.</p>

<h3>Services</h3>
<p>Lists every hosting plan you own. Click on any service to:</p>
<ul>
  <li>Login directly to cPanel with one click</li>
  <li>View your disk usage, bandwidth, and plan details</li>
  <li>Request an upgrade to a higher plan</li>
  <li>View your hosting expiry date</li>
</ul>
${SS("Services list showing hosting plan details, expiry date, and Login to cPanel button")}

<h3>Domains</h3>
<p>Manage all domains registered through Noehost. You can view expiry dates, update nameservers, and renew domains here.</p>

<h3>Invoices</h3>
<p>View and pay all invoices — past, present, and upcoming. Click any invoice to see the line items and pay with bank transfer or other accepted methods.</p>
${SS("Invoices section showing paid and unpaid invoices")}

<h3>Support Tickets</h3>
<p>Open new support requests and track the status of existing ones. Our team typically responds within 1–4 hours during business hours.</p>

<h3>Profile & Security</h3>
<p>Update your name, email, phone, address, and password here. Keep this information current so you receive all renewal and billing notifications.</p>`,
    },

    {
      categoryId: catMap["getting-started"],
      title: "How to Order a Hosting Plan on Noehost",
      slug: "how-to-order-a-hosting-plan-noehost",
      excerpt: "Step-by-step guide to choosing and ordering your first Noehost hosting plan.",
      seoTitle: "How to Order Hosting on Noehost — Step-by-Step Guide",
      seoDescription: "Learn how to select, configure, and order a web hosting plan on Noehost. Includes tips for choosing the right plan for your business.",
      content: `<h2>Choosing the Right Hosting Plan</h2>
<p>Noehost offers several hosting plans to suit different needs. Here's how to pick the right one:</p>
<ul>
  <li><strong>Starter Plan</strong> — Best for personal websites, portfolios, or blogs (1 website, 5 GB storage)</li>
  <li><strong>Business Plan</strong> — Ideal for small businesses (unlimited websites, more storage)</li>
  <li><strong>Premium Plan</strong> — For high-traffic sites and e-commerce (fastest performance)</li>
</ul>
${SS("Noehost hosting plan comparison table")}

<h2>Step-by-Step Ordering Process</h2>
<ol>
  <li>Go to <a href="https://noehost.com">noehost.com</a> and click <strong>Order Hosting</strong></li>
  <li>Select a plan that fits your needs and click <strong>Get Started</strong></li>
  <li>Choose your domain option:<br>
    • Register a new domain (additional cost)<br>
    • Transfer an existing domain<br>
    • Use a domain you already own (just update nameservers)</li>
  <li>Review your order summary and apply any promo code</li>
  <li>Click <strong>Checkout</strong> and select your payment method</li>
  <li>Complete the payment — you'll receive confirmation by email</li>
</ol>
${SS("Order checkout page with domain selection and plan summary")}

<h2>After Your Order</h2>
<p>Your hosting account is typically activated within 30 minutes to 2 hours after payment is confirmed. You'll receive a Welcome Email with your login credentials.</p>
<p>If activation takes longer, open a support ticket and our team will check your order immediately.</p>`,
    },

    {
      categoryId: catMap["getting-started"],
      title: "Getting Your Website Online: A Complete Beginner's Guide",
      slug: "getting-your-website-online-beginners-guide",
      excerpt: "From zero to live — everything a beginner needs to know to publish a website with Noehost.",
      seoTitle: "How to Get Your Website Online with Noehost — Beginner's Guide",
      seoDescription: "A beginner-friendly guide to publishing your website with Noehost hosting. Covers domain, hosting, WordPress installation, and going live.",
      content: `<h2>What You Need to Get Online</h2>
<p>Publishing a website requires two things:</p>
<ol>
  <li><strong>A Domain Name</strong> — Your website address (e.g., <code>yourbusiness.com</code>)</li>
  <li><strong>Hosting</strong> — A server where your website files live</li>
</ol>
<p>Noehost provides both. You can register a domain and get hosting together in one order.</p>
${SS("Domain + Hosting bundle selection on Noehost")}

<h2>Option A: Using WordPress (Recommended for Beginners)</h2>
<p>WordPress powers over 40% of all websites on the internet. It's free and has thousands of themes and plugins.</p>
<ol>
  <li>Log in to cPanel</li>
  <li>Scroll to the <strong>Softaculous Apps Installer</strong> section</li>
  <li>Click <strong>WordPress</strong> then <strong>Install Now</strong></li>
  <li>Fill in your site name, admin username, and password</li>
  <li>Click <strong>Install</strong> — takes about 2 minutes</li>
  <li>Visit your domain to see your new WordPress site!</li>
</ol>
${SS("Softaculous WordPress installer screen in cPanel")}

<h2>Option B: Uploading an Existing Website</h2>
<p>If you already have website files (HTML, CSS, images):</p>
<ol>
  <li>Log in to cPanel</li>
  <li>Open <strong>File Manager</strong></li>
  <li>Navigate to <code>public_html</code></li>
  <li>Click <strong>Upload</strong> and select your files</li>
</ol>

<h2>Your Website Is Live!</h2>
<p>Once DNS propagation completes (up to 24 hours), anyone can visit your domain and see your website. If you see a "default page", your files haven't been uploaded yet or DNS is still propagating.</p>`,
    },

    // ── CPANEL & TECHNICAL ──────────────────────────────────────────────────
    {
      categoryId: catMap["cpanel-technical"],
      title: "How to Create a Business Email on Noehost",
      titleUr: "Noehost پر بزنس ای میل کیسے بنائیں",
      titleAr: "كيفية إنشاء بريد إلكتروني احترافي على Noehost",
      slug: "how-to-create-business-email-noehost",
      excerpt: "Set up a professional @yourdomain.com email in minutes using cPanel.",
      excerptUr: "cPanel کے ذریعے @yourdomain.com ای میل چند منٹ میں بنائیں۔",
      excerptAr: "أنشئ بريدًا إلكترونيًا احترافيًا بنطاقك الخاص في دقائق.",
      seoTitle: "Create a Business Email on Noehost — Professional Email Setup Guide",
      seoDescription: "Learn how to create a professional business email like info@yourdomain.com using Noehost cPanel. Includes webmail and Outlook setup instructions.",
      isFeatured: true,
      content: `<h2>Why Use a Business Email?</h2>
<p>Having an email like <strong>info@yourbusiness.com</strong> looks professional, builds trust with customers, and keeps your business communication separate from personal email.</p>

<h2>Step 1 — Log In to cPanel</h2>
<p>From your Noehost Client Area, go to <strong>Services → Your Hosting Plan → Login to cPanel</strong>.</p>
${SS("cPanel login via Noehost Client Area — one-click access button")}

<h2>Step 2 — Open Email Accounts</h2>
<p>In cPanel, scroll to the <strong>Email</strong> section and click <strong>Email Accounts</strong>.</p>
${SS("cPanel Email section with Email Accounts icon highlighted")}

<h2>Step 3 — Create the Account</h2>
<ol>
  <li>Click the <strong>Create</strong> button</li>
  <li>Select your domain from the dropdown (e.g., <code>yourbusiness.com</code>)</li>
  <li>Enter a username — this becomes the part before the @. Example: <code>info</code>, <code>sales</code>, <code>support</code></li>
  <li>Set a strong password (use the generator for a secure one)</li>
  <li>Set the mailbox quota — <strong>Unlimited</strong> is recommended if your plan allows it</li>
  <li>Click <strong>Create Account</strong></li>
</ol>
${SS("Email Account creation form in cPanel — domain, username, password fields")}

<h2>Step 4 — Access Your Email</h2>
<h3>Option A: Webmail (No Setup Required)</h3>
<p>Go to <code>https://yourdomain.com/webmail</code> and log in with your full email address and password. Horde or Roundcube webmail clients are available.</p>

<h3>Option B: Outlook or Gmail App</h3>
<p>Use these server settings:</p>
<ul>
  <li><strong>Incoming (IMAP):</strong> mail.yourdomain.com, Port 993, SSL</li>
  <li><strong>Outgoing (SMTP):</strong> mail.yourdomain.com, Port 465, SSL</li>
  <li><strong>Username:</strong> your full email address</li>
  <li><strong>Password:</strong> the password you set above</li>
</ul>
${SS("Outlook email account setup with IMAP settings — server and port fields")}`,
    },

    {
      categoryId: catMap["cpanel-technical"],
      title: "Uploading Your Website via File Manager vs FTP",
      titleUr: "فائل مینیجر یا FTP کے ذریعے ویب سائٹ اپ لوڈ کریں",
      titleAr: "رفع موقعك عبر File Manager مقابل FTP",
      slug: "uploading-website-file-manager-vs-ftp",
      excerpt: "Two ways to upload your website files to Noehost — which method is right for you?",
      excerptUr: "Noehost پر فائلیں اپ لوڈ کرنے کے دو طریقے — کون سا بہتر ہے؟",
      excerptAr: "طريقتان لرفع ملفات موقعك على Noehost — أيهما أنسب لك؟",
      seoTitle: "Upload Website Files to Noehost — File Manager vs FTP Guide",
      seoDescription: "Learn two ways to upload your website to Noehost: using the cPanel File Manager or an FTP client like FileZilla. Includes step-by-step instructions.",
      isFeatured: true,
      content: `<h2>Overview: Two Upload Methods</h2>
<p>There are two main ways to upload files to your Noehost hosting account. Each has its advantages depending on your situation:</p>
<ul>
  <li><strong>cPanel File Manager</strong> — Best for quick uploads and small file counts. Works directly in your browser, no software needed.</li>
  <li><strong>FTP (FileZilla)</strong> — Best for large websites, bulk file transfers, or syncing folders. Requires a free FTP client.</li>
</ul>

<h2>Method 1: cPanel File Manager (Quick & Easy)</h2>
<ol>
  <li>Log in to cPanel via your Noehost Client Area</li>
  <li>In the <strong>Files</strong> section, click <strong>File Manager</strong></li>
  <li>Navigate to the <code>public_html</code> folder — this is your website root</li>
  <li>Click <strong>Upload</strong> in the top toolbar</li>
  <li>Drag and drop your files, or click to browse and select them</li>
  <li>Wait for the upload to complete, then click <strong>Go Back</strong></li>
</ol>
${SS("cPanel File Manager showing the public_html folder with Upload button")}
<p><strong>Important:</strong> Your main file (usually <code>index.html</code> or <code>index.php</code>) must be directly inside <code>public_html</code>, not in a subfolder.</p>

<h2>Method 2: FTP with FileZilla (Best for Large Sites)</h2>
<h3>Install FileZilla</h3>
<p>Download the free FileZilla FTP client from <a href="https://filezilla-project.org">filezilla-project.org</a>. It works on Windows, Mac, and Linux.</p>

<h3>Get Your FTP Credentials</h3>
<p>In cPanel, go to <strong>FTP Accounts</strong> to create a new FTP user, or use your main cPanel username and password:</p>
<ul>
  <li><strong>Host:</strong> your domain or server IP from your welcome email</li>
  <li><strong>Username:</strong> your cPanel username</li>
  <li><strong>Password:</strong> your cPanel password</li>
  <li><strong>Port:</strong> 21</li>
</ul>

<h3>Connect and Upload</h3>
<ol>
  <li>Open FileZilla and click <strong>File → Site Manager</strong></li>
  <li>Create a new site and fill in the credentials above</li>
  <li>Click <strong>Connect</strong></li>
  <li>On the right panel, navigate to <code>public_html</code></li>
  <li>On the left panel, browse to your local website folder</li>
  <li>Select all files and drag them to the right panel</li>
</ol>
${SS("FileZilla connected to Noehost server — local files on left, public_html on right")}`,
    },

    {
      categoryId: catMap["cpanel-technical"],
      title: "Changing PHP Versions for Better Performance",
      titleUr: "بہتر پرفارمنس کے لیے PHP ورژن کیسے بدلیں",
      titleAr: "كيفية تغيير إصدار PHP لأداء أفضل",
      slug: "changing-php-versions-noehost",
      excerpt: "Switch your PHP version in cPanel to improve compatibility and speed for your website.",
      excerptUr: "cPanel میں PHP ورژن تبدیل کریں تاکہ ویب سائٹ تیز اور متوافق ہو۔",
      excerptAr: "غيّر إصدار PHP في cPanel لتحسين التوافق وسرعة موقعك.",
      seoTitle: "How to Change PHP Version on Noehost cPanel — Performance Guide",
      seoDescription: "Learn how to switch PHP versions on Noehost hosting using MultiPHP Manager in cPanel. Improve your website's speed and WordPress compatibility.",
      isFeatured: true,
      content: `<h2>Why PHP Version Matters</h2>
<p>PHP is the programming language that powers most websites (including WordPress). Newer PHP versions are significantly faster and more secure. WordPress 6.x, for example, recommends <strong>PHP 8.1 or higher</strong> for best performance.</p>

<h2>How to Check Your Current PHP Version</h2>
<p>In cPanel, go to <strong>Software → PHP Version</strong> or <strong>MultiPHP Manager</strong> to see what version you're currently running.</p>
${SS("cPanel Software section showing MultiPHP Manager and current PHP version")}

<h2>Step-by-Step: Changing PHP Version</h2>
<ol>
  <li>Log in to cPanel via your Noehost Client Area</li>
  <li>In the <strong>Software</strong> section, click <strong>MultiPHP Manager</strong></li>
  <li>Find your domain in the list and check the checkbox next to it</li>
  <li>In the PHP Version dropdown at the top, select your desired version (e.g., <strong>PHP 8.2</strong>)</li>
  <li>Click <strong>Apply</strong></li>
</ol>
${SS("MultiPHP Manager — domain selected with PHP 8.2 chosen in dropdown")}

<h2>Which PHP Version Should You Use?</h2>
<ul>
  <li><strong>PHP 8.2 (Recommended)</strong> — Latest stable, fastest, best for WordPress 6.x</li>
  <li><strong>PHP 8.1</strong> — Excellent choice, widely supported</li>
  <li><strong>PHP 7.4</strong> — Only use if your plugins/theme require it</li>
  <li><strong>PHP 5.x / 7.0–7.3</strong> — Outdated, avoid unless absolutely necessary</li>
</ul>

<h2>What If My Website Breaks After Changing?</h2>
<p>Some old plugins or themes may not be compatible with newer PHP versions. If your site breaks:</p>
<ol>
  <li>Immediately revert to the previous PHP version in MultiPHP Manager</li>
  <li>Update all WordPress plugins and themes to their latest versions</li>
  <li>Try upgrading PHP again</li>
</ol>
<p>If you're still stuck, open a Noehost support ticket — our team can review error logs and help identify the incompatible plugin.</p>`,
    },

    {
      categoryId: catMap["cpanel-technical"],
      title: "How to Log In to cPanel on Noehost",
      slug: "how-to-log-in-to-cpanel-noehost",
      excerpt: "Three ways to access your cPanel hosting control panel on Noehost.",
      seoTitle: "How to Access cPanel on Noehost — 3 Login Methods",
      seoDescription: "Learn three ways to log in to cPanel on Noehost: via the Client Area, direct URL, or IP address. Includes troubleshooting tips.",
      content: `<h2>What Is cPanel?</h2>
<p>cPanel is the industry-standard web hosting control panel. From cPanel you can manage your website files, email accounts, databases, domains, security settings, and much more.</p>

<h2>Method 1: Through Your Noehost Client Area (Recommended)</h2>
<ol>
  <li>Log in to your Noehost Client Area</li>
  <li>Click <strong>Services</strong> in the sidebar</li>
  <li>Click on your active hosting plan</li>
  <li>Click the <strong>Login to cPanel</strong> button</li>
</ol>
<p>This method logs you in automatically — no need to enter your cPanel username or password.</p>
${SS("Noehost Client Area — Services page with Login to cPanel button highlighted")}

<h2>Method 2: Direct URL</h2>
<p>Visit one of these URLs in your browser (replace <code>yourdomain.com</code> with your actual domain):</p>
<ul>
  <li>HTTP: <code>http://yourdomain.com:2082</code></li>
  <li>HTTPS (Recommended): <code>https://yourdomain.com:2083</code></li>
</ul>
<p>Enter your cPanel username and password from your Noehost Welcome Email.</p>

<h2>Method 3: Via Server IP</h2>
<p>If your domain's DNS hasn't propagated yet, use your server IP address from your welcome email:</p>
<ul>
  <li><code>http://SERVER_IP:2082</code></li>
</ul>

<h2>Can't Log In?</h2>
<p>If you've forgotten your cPanel password:</p>
<ol>
  <li>Go to your Noehost Client Area</li>
  <li>Navigate to <strong>Services → Your Hosting Plan</strong></li>
  <li>Look for the option to <strong>Change cPanel Password</strong></li>
</ol>
<p>Or open a support ticket and our team will reset it for you.</p>`,
    },

    // ── WORDPRESS SPECIAL ───────────────────────────────────────────────────
    {
      categoryId: catMap["wordpress-special"],
      title: "One-Click WordPress Installation Guide on Noehost",
      titleUr: "Noehost پر WordPress ایک کلک سے انسٹال کریں",
      titleAr: "دليل تثبيت WordPress بنقرة واحدة على Noehost",
      slug: "one-click-wordpress-installation-noehost",
      excerpt: "Install WordPress in under 5 minutes using Softaculous in your Noehost cPanel.",
      excerptUr: "Noehost cPanel میں Softaculous سے 5 منٹ میں WordPress انسٹال کریں۔",
      excerptAr: "ثبّت WordPress في أقل من 5 دقائق باستخدام Softaculous في cPanel.",
      seoTitle: "Install WordPress on Noehost in 5 Minutes — One-Click Setup Guide",
      seoDescription: "Step-by-step guide to installing WordPress on Noehost using Softaculous. Includes SSL setup, admin login, and first-time configuration tips.",
      isFeatured: true,
      content: `<h2>Why WordPress?</h2>
<p>WordPress is the world's most popular website platform, powering over 40% of all websites. It's free, beginner-friendly, and has thousands of professional themes and plugins.</p>

<h2>Prerequisites</h2>
<ul>
  <li>An active Noehost hosting account</li>
  <li>A domain pointed to Noehost (ns1.noehost.com / ns2.noehost.com)</li>
  <li>cPanel access</li>
</ul>

<h2>Step 1 — Open Softaculous in cPanel</h2>
<ol>
  <li>Log in to cPanel via your Noehost Client Area</li>
  <li>Scroll to the <strong>Software</strong> section</li>
  <li>Click <strong>Softaculous Apps Installer</strong></li>
</ol>
${SS("cPanel Software section showing Softaculous Apps Installer icon")}

<h2>Step 2 — Select WordPress</h2>
<ol>
  <li>In Softaculous, click the <strong>WordPress</strong> icon (or search for it)</li>
  <li>Click the <strong>Install Now</strong> button</li>
</ol>
${SS("Softaculous dashboard with WordPress featured and Install Now button")}

<h2>Step 3 — Configure Your Installation</h2>
<p>Fill in the installation form:</p>
<ul>
  <li><strong>Choose Protocol:</strong> Select <code>https://</code> (recommended)</li>
  <li><strong>Choose Domain:</strong> Select your domain</li>
  <li><strong>In Directory:</strong> Leave blank to install at root, or type a folder name</li>
  <li><strong>Site Name:</strong> Your website name (can change later)</li>
  <li><strong>Admin Username:</strong> Choose something other than "admin" for security</li>
  <li><strong>Admin Password:</strong> Use a strong, unique password</li>
  <li><strong>Admin Email:</strong> Your email for WordPress notifications</li>
</ul>
${SS("Softaculous WordPress configuration form — protocol, domain, admin credentials")}

<h2>Step 4 — Install</h2>
<p>Scroll down and click <strong>Install</strong>. The process takes 1–3 minutes. You'll see a success screen with:</p>
<ul>
  <li>Your website URL: <code>https://yourdomain.com</code></li>
  <li>Your WordPress admin URL: <code>https://yourdomain.com/wp-admin</code></li>
</ul>
${SS("Softaculous installation complete screen with website and admin links")}

<h2>Step 5 — First Login to WordPress</h2>
<p>Go to <code>https://yourdomain.com/wp-admin</code> and enter your admin username and password. You're now in the WordPress Dashboard!</p>

<h2>Recommended First Steps in WordPress</h2>
<ol>
  <li>Go to <strong>Appearance → Themes</strong> and choose a theme</li>
  <li>Go to <strong>Plugins → Add New</strong> and install a page builder like Elementor</li>
  <li>Update your <strong>Site Title and Tagline</strong> under Settings → General</li>
  <li>Enable an SSL certificate if not already done (free via cPanel → SSL/TLS)</li>
</ol>`,
    },

    {
      categoryId: catMap["wordpress-special"],
      title: "Fixing the 'White Screen of Death' and Common WordPress Errors",
      titleUr: "WordPress کی 'وائٹ اسکرین آف ڈیتھ' اور عام غلطیاں کیسے ٹھیک کریں",
      titleAr: "إصلاح 'الشاشة البيضاء' وأخطاء WordPress الشائعة",
      slug: "fixing-white-screen-of-death-wordpress",
      excerpt: "Diagnose and fix the most common WordPress errors including WSOD, 404, and 500 errors.",
      excerptUr: "WordPress کی عام غلطیاں جیسے WSOD، 404 اور 500 errors ٹھیک کریں۔",
      excerptAr: "تشخيص وإصلاح أكثر أخطاء WordPress شيوعًا بما فيها الشاشة البيضاء.",
      seoTitle: "Fix WordPress White Screen of Death & Common Errors | Noehost Help",
      seoDescription: "Step-by-step solutions for WordPress White Screen of Death (WSOD), 500 Internal Server Error, 404 errors, and login issues on Noehost hosting.",
      isFeatured: true,
      content: `<h2>WordPress White Screen of Death (WSOD)</h2>
<p>The WSOD shows a blank white page instead of your website. It's usually caused by a plugin conflict, PHP error, or memory limit. Here's how to fix it:</p>

<h3>Solution 1 — Disable All Plugins via File Manager</h3>
<ol>
  <li>Log in to cPanel → <strong>File Manager</strong></li>
  <li>Navigate to <code>public_html/wp-content/plugins</code></li>
  <li>Right-click the <strong>plugins</strong> folder and rename it to <strong>plugins_disabled</strong></li>
  <li>Visit your website — if it works, a plugin was causing the issue</li>
  <li>Rename the folder back to <strong>plugins</strong></li>
  <li>Activate plugins one by one to find the culprit</li>
</ol>
${SS("cPanel File Manager — plugins folder inside wp-content, right-click context menu")}

<h3>Solution 2 — Increase PHP Memory Limit</h3>
<ol>
  <li>In cPanel File Manager, navigate to <code>public_html</code></li>
  <li>Find or create a file called <code>wp-config.php</code></li>
  <li>Add this line before <code>/* That's all, stop editing! */</code>:<br>
    <code>define('WP_MEMORY_LIMIT', '256M');</code></li>
  <li>Save and refresh your website</li>
</ol>

<h3>Solution 3 — Switch to a Default Theme</h3>
<p>In cPanel File Manager, go to <code>public_html/wp-content/themes</code> and rename your active theme folder. WordPress will automatically switch to a default theme (Twenty Twenty-Three).</p>

<hr />

<h2>500 Internal Server Error</h2>
<p>This error usually means a corrupted <code>.htaccess</code> file or PHP error.</p>
<h3>Fix 1 — Reset .htaccess</h3>
<ol>
  <li>In cPanel File Manager, find <code>public_html/.htaccess</code></li>
  <li>Rename it to <code>.htaccess_old</code></li>
  <li>If your site loads, log in to WordPress → Settings → Permalinks → click <strong>Save Changes</strong> (this regenerates .htaccess)</li>
</ol>
${SS("cPanel File Manager — .htaccess file selected in public_html")}

<hr />

<h2>WordPress 404 — Page Not Found</h2>
<p>If your pages work but posts show 404 errors, your permalink structure needs resaving.</p>
<ol>
  <li>Log in to WordPress admin</li>
  <li>Go to <strong>Settings → Permalinks</strong></li>
  <li>Without changing anything, click <strong>Save Changes</strong></li>
</ol>

<hr />

<h2>Can't Log In to WordPress</h2>
<p>If you forgot your WordPress password or can't log in:</p>
<ol>
  <li>Go to <code>yourdomain.com/wp-login.php</code> and click <strong>Lost Your Password?</strong></li>
  <li>Or reset it via phpMyAdmin in cPanel → find the <code>wp_users</code> table → edit your user → change <code>user_pass</code> (select MD5 function)</li>
</ol>

<p>Still stuck? Open a Noehost support ticket with your domain name and a description of the error — our team will diagnose it for you.</p>`,
    },

    {
      categoryId: catMap["wordpress-special"],
      title: "How to Install a WordPress Theme or Plugin",
      slug: "how-to-install-wordpress-theme-plugin",
      excerpt: "Add new themes and plugins to your WordPress site in minutes.",
      seoTitle: "How to Install WordPress Themes and Plugins on Noehost",
      seoDescription: "Learn how to install WordPress themes and plugins from the directory or via ZIP upload. Includes tips for picking reliable, safe extensions.",
      content: `<h2>Installing a WordPress Theme</h2>
<h3>From the WordPress Theme Directory (Free)</h3>
<ol>
  <li>Log in to your WordPress admin at <code>yourdomain.com/wp-admin</code></li>
  <li>Go to <strong>Appearance → Themes</strong></li>
  <li>Click <strong>Add New</strong></li>
  <li>Browse or search for a theme — use the Feature Filter to find themes for your industry</li>
  <li>Hover over a theme and click <strong>Install</strong>, then <strong>Activate</strong></li>
</ol>
${SS("WordPress Themes screen — Add New button and theme search results")}

<h3>Uploading a Premium Theme (ZIP File)</h3>
<ol>
  <li>Go to <strong>Appearance → Themes → Add New</strong></li>
  <li>Click <strong>Upload Theme</strong></li>
  <li>Click <strong>Choose File</strong> and select your theme .zip file</li>
  <li>Click <strong>Install Now</strong>, then <strong>Activate</strong></li>
</ol>

<h2>Installing a WordPress Plugin</h2>
<h3>From the WordPress Plugin Directory (Free)</h3>
<ol>
  <li>Go to <strong>Plugins → Add New</strong></li>
  <li>Search for the plugin you need (e.g., "Contact Form 7", "WooCommerce", "Yoast SEO")</li>
  <li>Click <strong>Install Now</strong> next to the plugin</li>
  <li>Click <strong>Activate</strong> once installed</li>
</ol>
${SS("WordPress Plugins screen showing search results and Install Now buttons")}

<h3>Uploading a Premium Plugin (ZIP File)</h3>
<ol>
  <li>Go to <strong>Plugins → Add New → Upload Plugin</strong></li>
  <li>Choose your .zip file and click <strong>Install Now</strong></li>
  <li>Click <strong>Activate Plugin</strong></li>
</ol>

<h2>Tips for Safe Plugin Use</h2>
<ul>
  <li>Only install plugins with high ratings (4+ stars) and many installs</li>
  <li>Check that the plugin has been updated recently (within the last 6 months)</li>
  <li>Keep all plugins updated to avoid security vulnerabilities</li>
  <li>Remove plugins you don't use — they still consume server resources even when inactive</li>
</ul>`,
    },

    {
      categoryId: catMap["wordpress-special"],
      title: "How to Speed Up Your WordPress Website",
      slug: "speed-up-wordpress-site-noehost",
      excerpt: "Proven techniques to make your WordPress site load faster on Noehost hosting.",
      seoTitle: "Speed Up WordPress on Noehost — Complete Optimization Guide",
      seoDescription: "Speed up your WordPress website on Noehost with caching, image optimization, PHP upgrades, and CDN. Step-by-step performance guide.",
      content: `<h2>Why Page Speed Matters</h2>
<p>Google uses page speed as a ranking factor. A site that loads in under 2 seconds converts visitors better and ranks higher in search results.</p>

<h2>Step 1 — Upgrade to PHP 8.2</h2>
<p>Newer PHP versions process requests significantly faster. In cPanel, go to <strong>MultiPHP Manager</strong> and switch to PHP 8.2 (see our PHP version guide for details).</p>

<h2>Step 2 — Install a Caching Plugin</h2>
<p>Caching stores pre-built pages so your server doesn't rebuild them for every visitor. Install one of these:</p>
<ul>
  <li><strong>LiteSpeed Cache</strong> — Best for Noehost LiteSpeed servers (free)</li>
  <li><strong>W3 Total Cache</strong> — Comprehensive, widely used (free)</li>
  <li><strong>WP Super Cache</strong> — Simple and beginner-friendly (free)</li>
</ul>
${SS("WordPress plugin search results for 'LiteSpeed Cache' showing Install button")}

<h2>Step 3 — Optimize Images</h2>
<p>Large images are the #1 reason websites load slowly. Fix this:</p>
<ul>
  <li>Install the <strong>Smush</strong> plugin (automatically compresses images)</li>
  <li>Use WebP format instead of JPG/PNG where possible</li>
  <li>Never upload images larger than 1920px wide</li>
</ul>

<h2>Step 4 — Use a CDN (Content Delivery Network)</h2>
<p>A CDN serves your images, CSS, and JavaScript from servers near your visitors — dramatically reducing load time for international visitors. Cloudflare's free plan works well with Noehost.</p>

<h2>Step 5 — Minimize Plugins</h2>
<p>Each plugin adds load time. Audit your plugins and remove any you don't actively use. Aim for under 20 active plugins for best performance.</p>

<h2>Step 6 — Enable GZIP Compression</h2>
<p>Add these lines to your <code>.htaccess</code> file in cPanel File Manager:</p>
<code>&lt;IfModule mod_deflate.c&gt;<br>&nbsp;&nbsp;AddOutputFilterByType DEFLATE text/html text/css application/javascript<br>&lt;/IfModule&gt;</code>

<p>After applying these optimizations, test your site speed at <a href="https://pagespeed.web.dev">Google PageSpeed Insights</a> to measure improvement.</p>`,
    },

    // ── DOMAINS & BILLING ───────────────────────────────────────────────────
    {
      categoryId: catMap["domains-billing"],
      title: "How to Update Nameservers to ns1.noehost.com",
      titleUr: "Nameservers کو ns1.noehost.com پر کیسے سیٹ کریں",
      titleAr: "كيفية تحديث خوادم الأسماء إلى ns1.noehost.com",
      slug: "how-to-update-nameservers-ns1-noehost-com",
      excerpt: "Point your domain to Noehost by updating nameservers — works for GoDaddy, Namecheap, and any registrar.",
      excerptUr: "اپنے ڈومین کو Noehost سے جوڑیں — GoDaddy، Namecheap اور ہر رجسٹرار کے لیے گائیڈ۔",
      excerptAr: "وجّه نطاقك إلى Noehost بتحديث خوادم الأسماء — يعمل مع GoDaddy وNamecheap وأي مزود.",
      seoTitle: "Update Nameservers to Noehost — ns1.noehost.com Setup Guide",
      seoDescription: "Learn how to point your domain to Noehost hosting by updating nameservers to ns1.noehost.com and ns2.noehost.com at any domain registrar.",
      isFeatured: true,
      content: `<h2>What Are Nameservers?</h2>
<p>Nameservers tell the internet where your website is hosted. When someone types your domain name, nameservers direct them to the correct server. Think of them as a GPS that routes visitors to your hosting.</p>

<h2>Noehost Nameservers</h2>
<p>Set both of these at your domain registrar:</p>
<ul>
  <li><strong>Nameserver 1:</strong> <code>ns1.noehost.com</code></li>
  <li><strong>Nameserver 2:</strong> <code>ns2.noehost.com</code></li>
</ul>

<h2>How to Update — Step by Step</h2>

<h3>At GoDaddy</h3>
<ol>
  <li>Log in to <a href="https://godaddy.com">godaddy.com</a></li>
  <li>Click <strong>My Products</strong> → Find your domain → Click <strong>DNS</strong></li>
  <li>Scroll to <strong>Nameservers</strong> and click <strong>Change</strong></li>
  <li>Select <strong>Custom</strong> and enter our nameservers</li>
  <li>Click <strong>Save</strong></li>
</ol>
${SS("GoDaddy domain DNS page — Nameservers section with Custom option and ns1.noehost.com entered")}

<h3>At Namecheap</h3>
<ol>
  <li>Log in to <a href="https://namecheap.com">namecheap.com</a> → <strong>Domain List</strong></li>
  <li>Click <strong>Manage</strong> next to your domain</li>
  <li>Under <strong>Nameservers</strong>, choose <strong>Custom DNS</strong></li>
  <li>Enter <code>ns1.noehost.com</code> and <code>ns2.noehost.com</code></li>
  <li>Click the green checkmark to save</li>
</ol>
${SS("Namecheap domain management — Nameservers set to Custom DNS with Noehost servers")}

<h3>At Other Registrars</h3>
<p>The process is similar for all registrars — look for <strong>DNS Settings</strong>, <strong>Nameservers</strong>, or <strong>Name Server Management</strong> in your domain's control panel.</p>

<h2>How Long Does It Take?</h2>
<p>DNS propagation typically takes <strong>2 to 24 hours</strong>, though it's often faster (30–60 minutes). During this time your website may appear intermittently as DNS updates globally.</p>

<h2>How to Check If Propagation Is Complete</h2>
<p>Visit <a href="https://whatsmydns.net">whatsmydns.net</a>, enter your domain, and check the <strong>NS</strong> record. When you see <code>ns1.noehost.com</code> across most locations, propagation is complete.</p>
${SS("whatsmydns.net showing NS record results for a domain — green checkmarks across regions")}`,
    },

    {
      categoryId: catMap["domains-billing"],
      title: "Understanding Invoices and Setting Up Auto-Renew",
      titleUr: "انوائس کو سمجھیں اور آٹو رینیو سیٹ کریں",
      titleAr: "فهم الفواتير وإعداد التجديد التلقائي",
      slug: "understanding-invoices-auto-renew-noehost",
      excerpt: "Learn how Noehost invoices work and how to set up auto-renewal to avoid service interruption.",
      excerptUr: "Noehost انوائس کیسے کام کرتی ہیں اور سروس بند ہونے سے بچنے کے لیے آٹو رینیو کیسے لگائیں۔",
      excerptAr: "تعلم كيف تعمل فواتير Noehost وكيف تفعّل التجديد التلقائي لتجنب انقطاع الخدمة.",
      seoTitle: "Noehost Invoices & Auto-Renew — Complete Billing Guide",
      seoDescription: "Understand your Noehost invoices, payment methods, due dates, and how to set up automatic renewal to keep your hosting and domains active.",
      isFeatured: true,
      content: `<h2>How Noehost Invoices Work</h2>
<p>Noehost generates invoices automatically before your services expire. Here's what to know:</p>
<ul>
  <li>Invoices are generated <strong>14 days before</strong> your service renewal date</li>
  <li>You receive an email notification when a new invoice is ready</li>
  <li>Services are suspended if invoices remain unpaid after the due date</li>
  <li>You have a <strong>7-day grace period</strong> after suspension before termination</li>
</ul>

<h2>Reading Your Invoice</h2>
<p>Each invoice includes:</p>
<ul>
  <li><strong>Invoice Number</strong> — Unique reference for support queries</li>
  <li><strong>Due Date</strong> — Payment must be received by this date</li>
  <li><strong>Line Items</strong> — Each service with the billing period (e.g., Annual)</li>
  <li><strong>Amount in PKR</strong> — Total due in Pakistani Rupees</li>
</ul>
${SS("Noehost invoice showing line items, due date, and total amount in PKR")}

<h2>How to Pay an Invoice</h2>
<ol>
  <li>Log in to your Noehost Client Area</li>
  <li>Click <strong>Invoices</strong> in the sidebar</li>
  <li>Click on the unpaid invoice</li>
  <li>Click <strong>Pay Invoice</strong></li>
  <li>Select your payment method and complete the payment</li>
</ol>
${SS("Noehost Invoices list — unpaid invoice selected with Pay Invoice button")}

<h2>Payment Methods</h2>
<p>Noehost accepts:</p>
<ul>
  <li><strong>Bank Transfer</strong> — Transfer to our bank account and submit receipt via ticket</li>
  <li><strong>JazzCash / EasyPaisa</strong> — Contact support to arrange mobile payments</li>
  <li><strong>Credit/Debit Card</strong> — When available through our payment gateway</li>
</ul>

<h2>Setting Up Auto-Renew</h2>
<p>Auto-renewal ensures your services never expire accidentally. To enable it:</p>
<ol>
  <li>Log in to your Noehost Client Area</li>
  <li>Go to <strong>Services</strong> and click on your hosting plan</li>
  <li>Find the <strong>Auto Renew</strong> toggle and switch it <strong>On</strong></li>
</ol>
<p>For domains, go to <strong>Domains → Your Domain → Enable Auto-Renew</strong>.</p>
${SS("Noehost Client Area — Service details page with Auto-Renew toggle switched on")}

<h2>Late Payment Warning</h2>
<p>If you cannot pay on time, <strong>contact support before the due date</strong>. We can often arrange a short extension to prevent service suspension.</p>`,
    },

    {
      categoryId: catMap["domains-billing"],
      title: "How to Register a New Domain on Noehost",
      slug: "how-to-register-new-domain-noehost",
      excerpt: "Search, check availability, and register your domain name through Noehost.",
      seoTitle: "Register a Domain Name on Noehost — Step-by-Step Guide",
      seoDescription: "Search for and register a .com, .pk, .net, or other domain name through Noehost. Includes tips for choosing the right domain for your business.",
      content: `<h2>Choosing the Right Domain Name</h2>
<p>Your domain name is your online identity. Here are some tips:</p>
<ul>
  <li>Keep it short and easy to spell (avoid hyphens or numbers)</li>
  <li>Use a <strong>.com</strong> for international reach or <strong>.pk</strong> for Pakistani businesses</li>
  <li>Include a keyword related to your business if the name is available</li>
  <li>Avoid trademarked names</li>
</ul>

<h2>Step-by-Step Domain Registration</h2>
<ol>
  <li>Go to <a href="https://noehost.com">noehost.com</a> and find the Domain Search tool</li>
  <li>Type your desired domain name and click <strong>Search</strong></li>
  <li>Check availability — if taken, you'll see alternative suggestions</li>
  <li>Click <strong>Add to Cart</strong> next to your chosen domain</li>
  <li>Proceed to checkout</li>
  <li>Fill in your registrant details (name, email, address) — these are required by ICANN</li>
  <li>Complete payment</li>
</ol>
${SS("Noehost domain search results showing available and unavailable domains")}

<h2>WHOIS Privacy</h2>
<p>By default, your registration details (name, email, address) are publicly visible in the WHOIS database. Noehost offers WHOIS privacy protection to hide this information from spammers and data scrapers.</p>

<h2>After Registration</h2>
<p>Your domain is registered immediately after payment. If you also have Noehost hosting, your nameservers are set automatically. The domain will be visible in your Client Area under <strong>Domains</strong>.</p>`,
    },

    {
      categoryId: catMap["domains-billing"],
      title: "How to Transfer a Domain to Noehost",
      slug: "how-to-transfer-domain-to-noehost",
      excerpt: "Move your existing domain from any registrar to Noehost using your EPP transfer code.",
      seoTitle: "Transfer Your Domain to Noehost — Complete Transfer Guide",
      seoDescription: "Transfer your domain from GoDaddy, Namecheap, or any registrar to Noehost. Step-by-step guide with EPP code, unlock instructions, and timeline.",
      content: `<h2>What Is a Domain Transfer?</h2>
<p>A domain transfer moves your domain from your current registrar to Noehost. Your website and email continue to work normally during the transfer — only the management changes.</p>

<h2>Before You Start</h2>
<ul>
  <li>Your domain must be at least <strong>60 days old</strong></li>
  <li>The domain must be <strong>unlocked</strong> at your current registrar</li>
  <li>You need the <strong>EPP/Auth Code</strong> (also called Transfer Authorization Code) from your registrar</li>
  <li>Your domain's WHOIS email must be accessible — you'll receive a confirmation there</li>
</ul>

<h2>Step 1 — Unlock Your Domain</h2>
<p>Log in to your current registrar and find the domain lock setting. Disable the transfer lock or registrar lock. Each registrar has a slightly different interface — look for "Domain Lock" or "Transfer Lock".</p>
${SS("GoDaddy domain lock setting — toggle switched to OFF (unlocked)")}

<h2>Step 2 — Get Your EPP/Auth Code</h2>
<p>Request the EPP/Authorization Code from your current registrar. It's typically emailed to the domain's admin email address within minutes.</p>

<h2>Step 3 — Initiate Transfer at Noehost</h2>
<ol>
  <li>Log in to your Noehost Client Area</li>
  <li>Go to <strong>Domains → Transfer a Domain</strong></li>
  <li>Enter your domain name and click <strong>Check</strong></li>
  <li>Enter your EPP Code</li>
  <li>Add to cart and complete checkout</li>
</ol>
${SS("Noehost domain transfer page — domain name and EPP code entry fields")}

<h2>Step 4 — Approve the Transfer</h2>
<p>Check the email address associated with your domain. You'll receive a transfer approval request. Click the approval link to speed up the process.</p>

<h2>Transfer Timeline</h2>
<p>Domain transfers typically take <strong>5–7 days</strong>. You'll receive an email once the transfer is complete. Some registrars process it faster (within 24–48 hours) when you approve immediately.</p>`,
    },

    {
      categoryId: catMap["domains-billing"],
      title: "Noehost Refund Policy and How to Request a Refund",
      slug: "noehost-refund-policy-how-to-request",
      excerpt: "Learn Noehost's refund policy and the correct steps to submit a refund request.",
      seoTitle: "Noehost Refund Policy — How to Request a Refund",
      seoDescription: "Learn about Noehost's money-back guarantee and how to request a refund for hosting plans. Includes what's refundable and what's not.",
      content: `<h2>Noehost Money-Back Guarantee</h2>
<p>Noehost offers a <strong>30-day money-back guarantee</strong> on shared hosting plans. If you're not satisfied within the first 30 days, you can request a full refund.</p>

<h2>What Is Refundable?</h2>
<ul>
  <li>✅ Shared hosting plans (within 30 days of activation)</li>
  <li>✅ Add-on services (within 30 days, case-by-case)</li>
  <li>❌ Domain registrations (non-refundable — domain cost is charged by the registry)</li>
  <li>❌ SSL certificates (non-refundable once issued)</li>
  <li>❌ Hosting renewals (non-refundable)</li>
  <li>❌ Services used beyond 30 days</li>
</ul>

<h2>How to Request a Refund</h2>
<ol>
  <li>Log in to your Noehost Client Area</li>
  <li>Go to <strong>Support → Open Ticket</strong></li>
  <li>Select <strong>Billing Department</strong></li>
  <li>Title your ticket: "Refund Request — Invoice #XXXXX"</li>
  <li>Include: your invoice number, the service you want refunded, and the reason</li>
  <li>Submit the ticket</li>
</ol>
<p>Our billing team reviews refund requests within 1–3 business days.</p>

<h2>Refund Processing Time</h2>
<p>Approved refunds are processed within 5–7 business days. The refund method depends on the original payment method:</p>
<ul>
  <li>Bank transfers are refunded back to your account credit (usable for future services)</li>
  <li>For other payment methods, we process the refund back to the original payment method where possible</li>
</ul>`,
    },

    // ── ACCOUNT & SECURITY ──────────────────────────────────────────────────
    {
      categoryId: catMap["account-security"],
      title: "How to Change Your Noehost Account Password",
      slug: "how-to-change-account-password-noehost",
      excerpt: "Update your Client Area password to keep your Noehost account secure.",
      seoTitle: "Change Noehost Account Password — Security Settings Guide",
      seoDescription: "Learn how to change your Noehost Client Area password from the security settings page. Also covers what to do if you've forgotten your password.",
      content: `<h2>Why You Should Update Your Password Regularly</h2>
<p>Using a strong, unique password is the single most important security step you can take. We recommend changing your password every 3–6 months and immediately if you suspect any unauthorized access.</p>

<h2>Changing Your Password (When Logged In)</h2>
<ol>
  <li>Log in to your Noehost Client Area</li>
  <li>Click your name or <strong>Profile</strong> in the sidebar</li>
  <li>Go to the <strong>Security</strong> tab</li>
  <li>Under <strong>Change Password</strong>, enter your current password</li>
  <li>Enter your new password twice</li>
  <li>Click <strong>Update Password</strong></li>
</ol>
${SS("Noehost Client Area — Security tab showing Change Password form")}

<h2>Password Requirements</h2>
<ul>
  <li>Minimum 8 characters</li>
  <li>Must include uppercase and lowercase letters</li>
  <li>Must include at least one number and one special character (@, #, $, etc.)</li>
  <li>Do not reuse passwords from other sites</li>
</ul>

<h2>Forgot Your Password?</h2>
<p>If you can't log in:</p>
<ol>
  <li>Go to the Noehost login page</li>
  <li>Click <strong>Forgot Your Password?</strong></li>
  <li>Enter the email address on your account</li>
  <li>Check your email for a reset link (check spam if it doesn't arrive)</li>
  <li>Click the link and set a new password</li>
</ol>
${SS("Noehost login page with Forgot Password link highlighted")}
<p>If you no longer have access to your account email, open a support ticket from a different email address with your account details and photo ID for verification.</p>`,
    },

    {
      categoryId: catMap["account-security"],
      title: "How to Update Your Contact Information on Noehost",
      slug: "how-to-update-contact-information-noehost",
      excerpt: "Keep your name, email, phone, and address up to date for billing and service notifications.",
      seoTitle: "Update Contact Information on Noehost — Account Settings Guide",
      seoDescription: "Learn how to update your name, email, phone number, and address in your Noehost account. Keep your details current to receive all important notifications.",
      content: `<h2>Why Keeping Your Details Current Matters</h2>
<p>Noehost uses your contact information to send:</p>
<ul>
  <li>Invoice and payment receipts</li>
  <li>Domain and hosting renewal reminders</li>
  <li>Service suspension warnings</li>
  <li>Security alerts (like password reset emails)</li>
  <li>Support ticket responses</li>
</ul>
<p>If your email is outdated, you may miss critical communications and risk losing your services.</p>

<h2>Updating Your Profile</h2>
<ol>
  <li>Log in to your Noehost Client Area</li>
  <li>Click <strong>Profile</strong> from the sidebar or top menu</li>
  <li>Update any of the following fields:<br>
    • Full Name<br>
    • Email Address<br>
    • Phone Number<br>
    • Company Name (optional)<br>
    • Billing Address</li>
  <li>Click <strong>Save Changes</strong></li>
</ol>
${SS("Noehost Client Area — Profile settings page with name, email, and phone fields")}

<h2>Changing Your Email Address</h2>
<p>When you change your email address, Noehost may send a verification link to the new email. Click it to confirm the change. This is a security measure to prevent unauthorized email changes.</p>

<h2>Updating Your cPanel Password</h2>
<p>Your Client Area password and cPanel password are separate. To update your cPanel password:</p>
<ol>
  <li>Go to <strong>Services → Your Hosting Plan</strong></li>
  <li>Look for the <strong>Change cPanel Password</strong> option</li>
  <li>Enter and confirm your new password</li>
</ol>`,
    },

    // ── EMAIL & DNS ─────────────────────────────────────────────────────────
    {
      categoryId: catMap["email-dns"],
      title: "How to Set Up Your Email on Phone or Computer",
      slug: "how-to-set-up-email-on-device-noehost",
      excerpt: "Configure your Noehost email in Outlook, iPhone Mail, Gmail, or any email app.",
      seoTitle: "Set Up Noehost Email on Phone & Computer — IMAP/SMTP Guide",
      seoDescription: "Configure your Noehost hosting email in Outlook, Apple Mail, Android, or Gmail. Complete IMAP and SMTP settings with step-by-step instructions.",
      content: `<h2>Server Settings for Noehost Email</h2>
<p>Use these settings in any email app (Outlook, Apple Mail, Thunderbird, Gmail, etc.):</p>

<h3>Incoming Mail — IMAP (Recommended)</h3>
<ul>
  <li><strong>Server:</strong> <code>mail.yourdomain.com</code></li>
  <li><strong>Port:</strong> 993</li>
  <li><strong>Encryption:</strong> SSL/TLS</li>
  <li><strong>Username:</strong> your full email (e.g., info@yourdomain.com)</li>
  <li><strong>Password:</strong> your email password</li>
</ul>

<h3>Outgoing Mail — SMTP</h3>
<ul>
  <li><strong>Server:</strong> <code>mail.yourdomain.com</code></li>
  <li><strong>Port:</strong> 465</li>
  <li><strong>Encryption:</strong> SSL/TLS</li>
  <li><strong>Authentication:</strong> Required (same username and password)</li>
</ul>

<h2>Setup on Microsoft Outlook</h2>
<ol>
  <li>Open Outlook → <strong>File → Add Account</strong></li>
  <li>Enter your email address and click <strong>Connect</strong></li>
  <li>Select <strong>IMAP</strong> as the account type</li>
  <li>Enter the incoming and outgoing server settings above</li>
  <li>Enter your password and click <strong>Done</strong></li>
</ol>
${SS("Microsoft Outlook — Add Account dialog with IMAP settings entered")}

<h2>Setup on iPhone/iPad</h2>
<ol>
  <li>Go to <strong>Settings → Mail → Accounts → Add Account → Other</strong></li>
  <li>Tap <strong>Add Mail Account</strong></li>
  <li>Enter your name, email, password, and description</li>
  <li>Choose <strong>IMAP</strong> and enter the server settings above</li>
  <li>Tap <strong>Save</strong></li>
</ol>
${SS("iPhone Mail account setup — Other account type selected with IMAP settings")}

<h2>Auto-Setup Files (Easier Method)</h2>
<p>In cPanel, go to <strong>Email Accounts → Check Email</strong> next to your email. Click <strong>Set Up Mail Client</strong> to download auto-configuration files for Outlook, iOS, and Android.</p>`,
    },

    {
      categoryId: catMap["email-dns"],
      title: "How to Add and Edit DNS Records on Noehost",
      slug: "how-to-add-edit-dns-records-noehost",
      excerpt: "Add A, CNAME, MX, TXT, and other DNS records for your domain using cPanel Zone Editor.",
      seoTitle: "Add & Edit DNS Records on Noehost — cPanel Zone Editor Guide",
      seoDescription: "Learn how to add, edit, and delete DNS records (A, CNAME, MX, TXT) for your domain in Noehost cPanel using the Zone Editor.",
      content: `<h2>Understanding DNS Records</h2>
<p>DNS records control how your domain works on the internet. Each type has a specific purpose:</p>
<ul>
  <li><strong>A Record</strong> — Maps your domain to an IP address (e.g., pointing to your hosting server)</li>
  <li><strong>CNAME Record</strong> — Creates an alias (e.g., www → yourdomain.com)</li>
  <li><strong>MX Record</strong> — Controls where emails are delivered</li>
  <li><strong>TXT Record</strong> — Stores text information (SPF, DKIM, domain verification)</li>
  <li><strong>AAAA Record</strong> — Like an A record but for IPv6 addresses</li>
</ul>

<h2>Accessing Zone Editor in cPanel</h2>
<ol>
  <li>Log in to cPanel via your Noehost Client Area</li>
  <li>In the <strong>Domains</strong> section, click <strong>Zone Editor</strong></li>
  <li>Find your domain and click <strong>Manage</strong></li>
</ol>
${SS("cPanel Zone Editor main page showing list of domains with Manage button")}

<h2>Adding a New DNS Record</h2>
<ol>
  <li>Click <strong>Add Record</strong></li>
  <li>Select the record type from the dropdown (A, CNAME, MX, etc.)</li>
  <li>Fill in the required fields (Name, Value/Content, TTL)</li>
  <li>Click <strong>Add Record</strong> to save</li>
</ol>
${SS("cPanel Zone Editor — Add Record form with Type, Name, and Value fields")}

<h2>Common DNS Record Examples</h2>
<h3>Adding a CNAME for www</h3>
<ul>
  <li>Type: CNAME</li>
  <li>Name: www</li>
  <li>Value: yourdomain.com.</li>
</ul>

<h3>Adding Google Workspace MX Records</h3>
<ul>
  <li>Type: MX</li>
  <li>Name: @ (or leave blank)</li>
  <li>Priority: 1</li>
  <li>Value: ASPMX.L.GOOGLE.COM.</li>
</ul>

<h2>How Long Do Changes Take?</h2>
<p>DNS changes within cPanel (when Noehost manages your DNS) take effect within <strong>5–15 minutes</strong>. Changes at external registrars can take up to 24–48 hours.</p>
<p><strong>Caution:</strong> Incorrect DNS changes can take your website or email offline. If you're unsure, open a support ticket and our team will help you make the changes correctly.</p>`,
    },

    {
      categoryId: catMap["email-dns"],
      title: "Setting Up SPF, DKIM, and DMARC for Better Email Deliverability",
      slug: "setting-up-spf-dkim-dmarc-noehost",
      excerpt: "Configure email authentication records to prevent spam and improve inbox delivery rates.",
      seoTitle: "SPF, DKIM & DMARC Setup on Noehost — Email Authentication Guide",
      seoDescription: "Configure SPF, DKIM, and DMARC DNS records on Noehost to prevent email spoofing and improve deliverability. Step-by-step cPanel guide.",
      content: `<h2>Why Email Authentication Matters</h2>
<p>Without SPF, DKIM, and DMARC, your emails may go to spam or be rejected entirely. These three DNS records prove your domain is authorized to send emails — improving deliverability to Gmail, Yahoo, Outlook, and others.</p>

<h2>SPF (Sender Policy Framework)</h2>
<p>SPF tells receiving servers which mail servers are allowed to send email from your domain.</p>
<h3>How to Add SPF</h3>
<ol>
  <li>Go to cPanel → <strong>Zone Editor</strong> → <strong>Manage</strong> your domain</li>
  <li>Look for an existing TXT record starting with <code>v=spf1</code></li>
  <li>If none exists, click <strong>Add Record</strong> → Type: TXT</li>
  <li>Name: @ (or leave blank)</li>
  <li>Value: <code>v=spf1 include:noehost.com ~all</code></li>
  <li>Save the record</li>
</ol>
${SS("cPanel Zone Editor — SPF TXT record with v=spf1 value")}

<h2>DKIM (DomainKeys Identified Mail)</h2>
<p>DKIM adds a cryptographic signature to outgoing emails, proving they weren't tampered with in transit. cPanel automatically generates a DKIM key for your domain.</p>
<h3>Enable DKIM in cPanel</h3>
<ol>
  <li>In cPanel, go to <strong>Email → Email Deliverability</strong></li>
  <li>Find your domain and check its DKIM status</li>
  <li>If not enabled, click <strong>Repair</strong> to automatically add the DKIM TXT record</li>
</ol>
${SS("cPanel Email Deliverability page showing DKIM and SPF status with Repair button")}

<h2>DMARC (Domain-based Message Authentication)</h2>
<p>DMARC tells receiving servers what to do with emails that fail SPF or DKIM checks.</p>
<h3>Add a Basic DMARC Record</h3>
<ol>
  <li>In cPanel Zone Editor, add a new TXT record</li>
  <li>Name: <code>_dmarc</code></li>
  <li>Value: <code>v=DMARC1; p=none; rua=mailto:admin@yourdomain.com</code></li>
</ol>
<p><strong>Policy options:</strong></p>
<ul>
  <li><code>p=none</code> — Monitor only (start here)</li>
  <li><code>p=quarantine</code> — Send failing emails to spam</li>
  <li><code>p=reject</code> — Reject failing emails entirely (most secure)</li>
</ul>

<h2>Verifying Your Email Authentication</h2>
<p>After setting up these records, wait 15–30 minutes then test at <a href="https://mxtoolbox.com/emailhealth">MXToolbox Email Health</a> or <a href="https://mail-tester.com">mail-tester.com</a> to confirm everything is configured correctly.</p>`,
    },

    // ── TROUBLESHOOTING ──────────────────────────────────────────────────────
    {
      categoryId: catMap["troubleshooting"],
      title: "Fixing 404 Not Found Errors on Your Website",
      titleUr: "ویب سائٹ پر 404 نہیں ملا کی غلطی ٹھیک کریں",
      titleAr: "إصلاح خطأ 404 غير موجود على موقعك",
      slug: "fixing-404-not-found-errors-noehost",
      excerpt: "A 404 error means the page cannot be found. Learn every cause and fix for 404 errors on Noehost hosting.",
      excerptUr: "404 کا مطلب ہے صفحہ نہیں ملا۔ Noehost پر تمام وجوہات اور حل جانیں۔",
      excerptAr: "خطأ 404 يعني أن الصفحة غير موجودة. تعرف على كل الأسباب والحلول.",
      seoTitle: "Fix 404 Not Found Errors on Noehost — Complete Troubleshooting Guide",
      seoDescription: "Getting 404 errors on your Noehost-hosted website? Follow our step-by-step guide to diagnose and fix broken links, missing files, and permalink issues.",
      isFeatured: true,
      content: `<h2>What Is a 404 Error?</h2>
<p>A <strong>404 Not Found</strong> error means your web server received the request but couldn't locate the file or page being asked for. It's one of the most common website errors and is almost always fixable.</p>

<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:1rem 1.25rem;border-radius:0.5rem;margin:1rem 0">
  <strong>Quick Diagnosis:</strong> Is the error on every page or just one? Every page → server/config issue. One page only → broken link or missing file.
</div>

<h2>Most Common Causes of 404 Errors</h2>
<ul>
  <li>The page was deleted or renamed without updating links</li>
  <li>WordPress permalinks are broken or not saved</li>
  <li>A file was not uploaded to the correct folder (<code>public_html</code>)</li>
  <li>A plugin or theme incorrectly rewrote URL rules</li>
  <li><code>.htaccess</code> file is missing, corrupted, or has wrong rules</li>
  <li>Case-sensitive filenames (e.g., <code>About.html</code> vs <code>about.html</code>)</li>
</ul>

<h2>Step 1 — Check the URL Carefully</h2>
<p>The simplest cause is a typo in the URL. Verify:</p>
<ul>
  <li>No extra spaces or special characters</li>
  <li>Correct spelling of the page slug</li>
  <li>The file extension is correct (e.g., <code>.html</code>, <code>.php</code>)</li>
</ul>

<h2>Step 2 — Check the File Exists in cPanel</h2>
<ol>
  <li>Log in to cPanel via your <a href="https://noehost.com">Noehost Client Area</a></li>
  <li>Open <strong>File Manager → public_html</strong></li>
  <li>Search for the file that should be at that URL</li>
  <li>If it's missing, re-upload it from your local computer</li>
</ol>
${SS("cPanel File Manager — public_html folder with file search for missing page")}

<h2>Step 3 — Fix WordPress Permalinks (Most Common WordPress Fix)</h2>
<p>If you're using WordPress and <em>all</em> inner pages give 404 errors, your permalink structure is broken.</p>
<ol>
  <li>Log in to your WordPress admin dashboard</li>
  <li>Go to <strong>Settings → Permalinks</strong></li>
  <li>Without changing anything, click <strong>Save Changes</strong></li>
  <li>This regenerates the <code>.htaccess</code> file and fixes rewrite rules</li>
</ol>
${SS("WordPress admin — Settings > Permalinks page with Save Changes button highlighted")}

<h2>Step 4 — Fix or Recreate the .htaccess File</h2>
<p>A corrupted <code>.htaccess</code> file causes all sorts of 404 errors. To reset it:</p>
<ol>
  <li>In cPanel File Manager, navigate to <code>public_html</code></li>
  <li>Enable <strong>Show Hidden Files</strong> (Settings → Show Hidden Files)</li>
  <li>Find <code>.htaccess</code> and rename it to <code>.htaccess.bak</code></li>
  <li>Create a new <code>.htaccess</code> file with this standard WordPress content:</li>
</ol>
<pre><code># BEGIN WordPress
&lt;IfModule mod_rewrite.c&gt;
RewriteEngine On
RewriteBase /
RewriteRule ^index\\.php$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.php [L]
&lt;/IfModule&gt;
# END WordPress</code></pre>
${SS("cPanel File Manager — .htaccess file in public_html with Edit option visible")}

<h2>Step 5 — Check for Redirects and Plugin Conflicts</h2>
<p>In WordPress, temporarily deactivate all plugins via <strong>Plugins → Installed Plugins → Bulk Deactivate</strong>, then test the URL. If the 404 disappears, reactivate plugins one by one to find the culprit.</p>

<h2>Step 6 — Set Up a Custom 404 Page</h2>
<p>Even after fixing the root cause, it's good practice to create a friendly 404 page that helps visitors find what they need. In WordPress, most themes include a custom <code>404.php</code> template. For static sites, add this to your <code>.htaccess</code>:</p>
<pre><code>ErrorDocument 404 /404.html</code></pre>

<h2>Still Getting 404?</h2>
<p>If none of the above steps resolve your issue, open a support ticket from your <a href="https://noehost.com">Noehost Client Area</a> with the specific URL returning the error and a description of when it started. Our team will investigate the server configuration for you.</p>`,
    },

    {
      categoryId: catMap["troubleshooting"],
      title: "Fixing 500 Internal Server Error on Noehost",
      titleUr: "Noehost پر 500 اندرونی سرور غلطی ٹھیک کریں",
      titleAr: "إصلاح خطأ 500 Internal Server Error على Noehost",
      slug: "fixing-500-internal-server-error-noehost",
      excerpt: "A 500 error means something went wrong on the server. This guide covers every cause and fix for 500 errors.",
      excerptUr: "500 کا مطلب ہے سرور پر کچھ غلط ہوا۔ تمام وجوہات اور حل جانیں۔",
      excerptAr: "خطأ 500 يعني حدث خطأ في الخادم. تعرف على الأسباب والحلول الكاملة.",
      seoTitle: "Fix 500 Internal Server Error on Noehost — Step-by-Step Guide",
      seoDescription: "Seeing a 500 Internal Server Error on your website? Learn how to diagnose and fix PHP errors, .htaccess issues, and plugin conflicts on Noehost hosting.",
      isFeatured: true,
      content: `<h2>What Is a 500 Internal Server Error?</h2>
<p>A <strong>500 Internal Server Error</strong> is a generic server-side error that means something went wrong but the server can't be more specific. Unlike a 404 (file not found), a 500 error is always a server or code configuration problem — not a typo in the URL.</p>

<div style="background:#fee2e2;border-left:4px solid #ef4444;padding:1rem 1.25rem;border-radius:0.5rem;margin:1rem 0">
  <strong>Common culprits:</strong> Corrupted .htaccess, PHP memory limit exceeded, file permission errors, faulty plugin or theme, or a PHP syntax error in a custom file.
</div>

<h2>Step 1 — Check PHP Error Logs</h2>
<p>Error logs tell you exactly what went wrong. In cPanel:</p>
<ol>
  <li>Go to <strong>Metrics → Errors</strong></li>
  <li>Review the most recent entries — look for <code>PHP Fatal error</code>, <code>syntax error</code>, or <code>memory exhausted</code></li>
  <li>The filename and line number in the log tells you exactly where the problem is</li>
</ol>
${SS("cPanel Metrics — Error Logs showing recent PHP Fatal error entries")}

<h2>Step 2 — Rename .htaccess to Disable It</h2>
<p>A corrupted <code>.htaccess</code> is the #1 cause of 500 errors. Temporarily disable it:</p>
<ol>
  <li>In cPanel File Manager, navigate to <code>public_html</code></li>
  <li>Enable <strong>Show Hidden Files</strong></li>
  <li>Right-click <code>.htaccess</code> and select <strong>Rename</strong></li>
  <li>Rename it to <code>.htaccess.bak</code></li>
  <li>Reload your website — if the 500 error disappears, the .htaccess was the problem</li>
  <li>Re-create a clean .htaccess (see our <a href="/help/fixing-404-not-found-errors-noehost">404 guide</a> for the standard WordPress template)</li>
</ol>
${SS("cPanel File Manager — renaming .htaccess to .htaccess.bak to isolate the issue")}

<h2>Step 3 — Fix PHP Memory Limit</h2>
<p>If your error log shows <code>Allowed memory size of X bytes exhausted</code>, you need to increase the PHP memory limit:</p>
<ol>
  <li>In cPanel File Manager, open <code>public_html/wp-config.php</code> (for WordPress) or <code>.htaccess</code></li>
  <li>Add this line to <code>wp-config.php</code> above the line that says "That's all, stop editing":</li>
</ol>
<pre><code>define('WP_MEMORY_LIMIT', '256M');</code></pre>
<p>Or in <code>.htaccess</code>:</p>
<pre><code>php_value memory_limit 256M</code></pre>
${SS("wp-config.php open in cPanel file editor with WP_MEMORY_LIMIT line added")}

<h2>Step 4 — Check File Permissions</h2>
<p>Incorrect file permissions cause 500 errors. The correct permissions on Noehost are:</p>
<ul>
  <li><strong>Folders:</strong> 755</li>
  <li><strong>Files:</strong> 644</li>
  <li><strong>wp-config.php:</strong> 600 (more secure)</li>
</ul>
<p>To fix permissions in bulk via cPanel:</p>
<ol>
  <li>Go to File Manager → right-click <code>public_html</code></li>
  <li>Choose <strong>Change Permissions</strong></li>
  <li>Set to 755 for directories, 644 for files</li>
</ol>

<h2>Step 5 — Disable All Plugins (WordPress)</h2>
<p>A faulty plugin is a very common cause. To disable all plugins without dashboard access:</p>
<ol>
  <li>In cPanel File Manager, navigate to <code>public_html/wp-content/plugins</code></li>
  <li>Rename the entire <code>plugins</code> folder to <code>plugins.bak</code></li>
  <li>Reload your website — if it loads, a plugin was the cause</li>
  <li>Rename <code>plugins.bak</code> back to <code>plugins</code></li>
  <li>Re-enable plugins one by one from WordPress admin to find the bad one</li>
</ol>
${SS("cPanel File Manager — wp-content folder with plugins renamed to plugins.bak")}

<h2>Step 6 — Switch PHP Version</h2>
<p>If you recently updated a plugin or theme, it may require a newer PHP version. In cPanel:</p>
<ol>
  <li>Go to <strong>Software → MultiPHP Manager</strong></li>
  <li>Select your domain</li>
  <li>Try PHP 8.1 or 8.2 (recommended for modern WordPress)</li>
  <li>Save and test your website</li>
</ol>

<h2>Still Getting 500 Errors?</h2>
<p>If none of these steps work, the issue may be server-level. Open a support ticket from your <a href="https://noehost.com">Noehost Client Area</a> with your domain name and a screenshot of the error log. Our technical team will investigate and resolve it for you.</p>`,
    },

    {
      categoryId: catMap["troubleshooting"],
      title: "DNS Propagation: What It Is and How Long It Takes",
      titleUr: "DNS پروپیگیشن کیا ہے اور کتنا وقت لگتا ہے",
      titleAr: "انتشار DNS: ما هو وكم يستغرق من الوقت",
      slug: "dns-propagation-explained-noehost",
      excerpt: "After updating nameservers or DNS records, changes take time to spread worldwide. Learn why and how to check propagation status.",
      excerptUr: "نیم سرور یا DNS ریکارڈ تبدیل کرنے کے بعد پوری دنیا میں وقت لگتا ہے۔ وجہ اور چیک کرنے کا طریقہ جانیں۔",
      excerptAr: "بعد تحديث خوادم الأسماء أو سجلات DNS، تستغرق التغييرات وقتاً للانتشار عالمياً.",
      seoTitle: "DNS Propagation Explained — How Long It Takes & How to Check | Noehost",
      seoDescription: "Changed your nameservers to ns1.noehost.com? Learn how DNS propagation works, how long it takes (2–48 hours), and how to check if your changes have spread.",
      isFeatured: true,
      content: `<h2>What Is DNS Propagation?</h2>
<p>When you update your domain's <strong>nameservers</strong> (e.g., from GoDaddy's nameservers to <code>ns1.noehost.com</code> and <code>ns2.noehost.com</code>), or change a DNS record, those changes don't take effect instantly around the world.</p>
<p>The internet uses a distributed system of thousands of DNS servers (called resolvers) worldwide. Each resolver caches DNS information for a period of time called the <strong>TTL (Time To Live)</strong>. Until each resolver's cache expires and refreshes, some visitors may still see your old website or get "site not found" errors.</p>
<p>This process of DNS information spreading globally is called <strong>DNS propagation</strong>.</p>

<h2>How Long Does DNS Propagation Take?</h2>
<table style="width:100%;border-collapse:collapse;margin:1rem 0">
  <thead>
    <tr style="background:var(--muted,#f3f4f6)">
      <th style="padding:0.75rem;text-align:left;border:1px solid var(--border,#e5e7eb)">Change Type</th>
      <th style="padding:0.75rem;text-align:left;border:1px solid var(--border,#e5e7eb)">Typical Time</th>
      <th style="padding:0.75rem;text-align:left;border:1px solid var(--border,#e5e7eb)">Maximum</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:0.75rem;border:1px solid var(--border,#e5e7eb)">Nameserver change</td>
      <td style="padding:0.75rem;border:1px solid var(--border,#e5e7eb)">2–12 hours</td>
      <td style="padding:0.75rem;border:1px solid var(--border,#e5e7eb)">48 hours</td>
    </tr>
    <tr style="background:var(--muted,#f9fafb)">
      <td style="padding:0.75rem;border:1px solid var(--border,#e5e7eb)">A Record change</td>
      <td style="padding:0.75rem;border:1px solid var(--border,#e5e7eb)">15 min – 4 hours</td>
      <td style="padding:0.75rem;border:1px solid var(--border,#e5e7eb)">24 hours</td>
    </tr>
    <tr>
      <td style="padding:0.75rem;border:1px solid var(--border,#e5e7eb)">MX Record change</td>
      <td style="padding:0.75rem;border:1px solid var(--border,#e5e7eb)">1–4 hours</td>
      <td style="padding:0.75rem;border:1px solid var(--border,#e5e7eb)">24 hours</td>
    </tr>
    <tr style="background:var(--muted,#f9fafb)">
      <td style="padding:0.75rem;border:1px solid var(--border,#e5e7eb)">CNAME/TXT Record</td>
      <td style="padding:0.75rem;border:1px solid var(--border,#e5e7eb)">5 min – 2 hours</td>
      <td style="padding:0.75rem;border:1px solid var(--border,#e5e7eb)">12 hours</td>
    </tr>
  </tbody>
</table>

<h2>How to Check DNS Propagation Status</h2>
<p>These free tools show you what DNS servers worldwide currently see for your domain:</p>
<ul>
  <li><a href="https://dnschecker.org" target="_blank">DNSChecker.org</a> — Shows propagation across 100+ locations</li>
  <li><a href="https://whatsmydns.net" target="_blank">WhatsMyDNS.net</a> — Clean real-time global propagation map</li>
  <li><a href="https://mxtoolbox.com/DNSLookup.aspx" target="_blank">MXToolbox DNS Lookup</a> — Detailed record inspection</li>
</ul>
${SS("DNSChecker.org showing global propagation map with green checkmarks confirming ns1.noehost.com")}

<h2>Step-by-Step: Pointing Your Domain to Noehost</h2>
<ol>
  <li>Log in to your domain registrar (GoDaddy, Namecheap, Google Domains, etc.)</li>
  <li>Find <strong>DNS Management</strong> or <strong>Nameservers</strong> settings</li>
  <li>Select <strong>Custom nameservers</strong> (not "Use default" or "Use registrar's")</li>
  <li>Enter:<br><code>NS1: ns1.noehost.com</code><br><code>NS2: ns2.noehost.com</code></li>
  <li>Save changes</li>
  <li>Check <a href="https://dnschecker.org" target="_blank">DNSChecker.org</a> every few hours to monitor propagation</li>
</ol>
${SS("Domain registrar DNS settings — custom nameservers fields showing ns1.noehost.com and ns2.noehost.com")}

<h2>What to Do During Propagation</h2>
<ul>
  <li><strong>Don't panic</strong> — Your old site may still show for some visitors while propagating; this is normal</li>
  <li><strong>Clear your browser cache</strong> — Your browser may be caching the old DNS result. Press <code>Ctrl+Shift+Delete</code> to clear it</li>
  <li><strong>Try incognito mode</strong> — Opens a fresh session without cached DNS</li>
  <li><strong>Use a VPN</strong> — Lets you test from a different DNS resolver to see your new site early</li>
  <li><strong>Check propagation tools</strong> — Once most locations show your new IP, your site is live globally</li>
</ul>

<h2>Why Is My Domain Still Not Working After 48 Hours?</h2>
<p>If 48 hours have passed and your domain still doesn't point to Noehost, check:</p>
<ol>
  <li>The nameservers were saved correctly (log in to your registrar and verify)</li>
  <li>Your domain is not expired (check the expiry date in your registrar account)</li>
  <li>The hosting service in your <a href="https://noehost.com">Noehost Client Area</a> is active and not suspended</li>
</ol>
<p>If everything looks correct, open a support ticket and our team will verify the DNS configuration for you.</p>`,
    },

    {
      categoryId: catMap["troubleshooting"],
      title: "Fixing 'Error Establishing a Database Connection' in WordPress",
      titleUr: "WordPress میں 'ڈیٹا بیس کنکشن کی غلطی' ٹھیک کریں",
      titleAr: "إصلاح خطأ 'Error Establishing a Database Connection' في WordPress",
      slug: "fixing-database-connection-error-wordpress",
      excerpt: "This error means WordPress can't reach its MySQL database. Follow these steps to restore your site quickly.",
      excerptUr: "یہ غلطی کا مطلب ہے WordPress MySQL ڈیٹا بیس تک نہیں پہنچ سکتا۔ ان مراحل سے اپنی سائٹ بحال کریں۔",
      excerptAr: "يعني هذا الخطأ أن WordPress لا يمكنه الوصول إلى قاعدة بيانات MySQL.",
      seoTitle: "Fix 'Error Establishing a Database Connection' in WordPress | Noehost",
      seoDescription: "Getting 'Error Establishing a Database Connection' on your WordPress site? Fix wrong DB credentials, corrupted tables, and MySQL server issues on Noehost.",
      content: `<h2>What Does This Error Mean?</h2>
<p>The <strong>"Error Establishing a Database Connection"</strong> message means WordPress cannot connect to its MySQL database. Every WordPress site stores all its content — posts, pages, settings, users — in a database, so if the connection fails, the entire site goes down.</p>

<div style="background:#fee2e2;border-left:4px solid #ef4444;padding:1rem 1.25rem;border-radius:0.5rem;margin:1rem 0">
  <strong>Note:</strong> This error can affect the front-end, the admin dashboard, or both. It always requires fixing the database credentials or repairing the database tables.
</div>

<h2>Step 1 — Verify Database Credentials in wp-config.php</h2>
<p>The most common cause is incorrect database credentials in <code>wp-config.php</code>. These credentials must exactly match what's configured in cPanel.</p>
<ol>
  <li>Log in to cPanel via your <a href="https://noehost.com">Noehost Client Area</a></li>
  <li>Go to <strong>File Manager → public_html</strong></li>
  <li>Right-click <code>wp-config.php</code> → <strong>Edit</strong></li>
  <li>Check these four values:</li>
</ol>
<pre><code>define('DB_NAME',     'yourusername_dbname');
define('DB_USER',     'yourusername_dbuser');
define('DB_PASSWORD', 'your_database_password');
define('DB_HOST',     'localhost');</code></pre>
${SS("wp-config.php open in cPanel file editor showing DB_NAME, DB_USER, DB_PASSWORD fields")}

<h2>Step 2 — Find the Correct Database Name and User</h2>
<ol>
  <li>In cPanel, go to <strong>Databases → MySQL Databases</strong></li>
  <li>Note your exact database name (format: <code>yourusername_dbname</code>)</li>
  <li>Note the database user assigned to it</li>
  <li>If you've forgotten the password, click <strong>Change Password</strong> for the database user, set a new one, and update <code>wp-config.php</code> to match</li>
</ol>
${SS("cPanel MySQL Databases page showing database name, user, and permissions")}

<h2>Step 3 — Repair the Database</h2>
<p>Corrupted database tables can also cause this error. WordPress has a built-in repair tool:</p>
<ol>
  <li>Edit <code>wp-config.php</code></li>
  <li>Add this line above "That's all, stop editing":</li>
</ol>
<pre><code>define('WP_ALLOW_REPAIR', true);</code></pre>
<ol start="3">
  <li>Visit <code>https://yourdomain.com/wp-admin/maint/repair.php</code></li>
  <li>Click <strong>Repair Database</strong></li>
  <li>After repair completes, <strong>remove</strong> the <code>WP_ALLOW_REPAIR</code> line from wp-config.php</li>
</ol>
${SS("WordPress database repair page at /wp-admin/maint/repair.php showing Repair Database button")}

<h2>Step 4 — Check MySQL Service via phpMyAdmin</h2>
<ol>
  <li>In cPanel, click <strong>phpMyAdmin</strong></li>
  <li>Try to open your WordPress database</li>
  <li>If phpMyAdmin loads normally and the database tables are visible, the connection works from the server side — go back to Step 1 to check wp-config.php credentials</li>
  <li>If phpMyAdmin shows errors too, there may be a server-level MySQL issue — contact Noehost support immediately</li>
</ol>
${SS("cPanel phpMyAdmin showing WordPress database tables — wp_posts, wp_options, wp_users visible")}

<h2>Step 5 — Check DB_HOST Value</h2>
<p>On most shared hosting including Noehost, <code>DB_HOST</code> should be <code>localhost</code>. However, occasionally it needs to be an IP address or a specific hostname. If <code>localhost</code> isn't working, try:</p>
<ul>
  <li><code>127.0.0.1</code></li>
  <li><code>localhost:3306</code></li>
</ul>

<h2>Step 6 — Increase MySQL Max Connections (Contact Support)</h2>
<p>If your database repeatedly disconnects under load, your hosting plan may have reached its MySQL connection limit. This is a server-level setting that our team can review. Open a support ticket from your <a href="https://noehost.com">Noehost Client Area</a> and mention the "Error Establishing a Database Connection" message — we'll check the server logs and increase limits if needed.</p>

<h2>Prevention Tips</h2>
<ul>
  <li>Keep regular database backups using cPanel's <strong>Backup Wizard</strong></li>
  <li>Use a WordPress plugin like <em>UpdraftPlus</em> for automated daily backups</li>
  <li>After every major update, verify your site loads correctly</li>
  <li>Avoid editing <code>wp-config.php</code> manually unless you know exactly what you're changing</li>
</ul>`,
    },

    {
      categoryId: catMap["troubleshooting"],
      title: "Website Showing Old Content After Update — How to Fix Caching Issues",
      titleUr: "اپ ڈیٹ کے بعد پرانا مواد دکھ رہا ہے — کیشنگ مسائل کیسے حل کریں",
      titleAr: "الموقع يعرض محتوى قديم بعد التحديث — كيفية إصلاح مشاكل التخزين المؤقت",
      slug: "fixing-caching-issues-website-not-updating-noehost",
      excerpt: "When your website shows old content after making changes, the issue is almost always caching. Learn how to clear every layer of cache.",
      excerptUr: "جب ویب سائٹ تبدیلیوں کے بعد پرانا مواد دکھائے تو مسئلہ عموماً کیش ہوتا ہے۔ ہر پرت کی کیش صاف کرنا سیکھیں۔",
      excerptAr: "عندما يعرض موقعك محتوى قديماً بعد التغييرات، المشكلة عادةً هي التخزين المؤقت.",
      seoTitle: "Fix Website Not Updating After Changes — Clear Cache on Noehost",
      seoDescription: "Website still showing old content after you made changes? Learn how to clear browser cache, WordPress cache plugins, server cache, and CDN cache on Noehost.",
      content: `<h2>Why Is My Website Showing Old Content?</h2>
<p>When you update your website but visitors (or you) still see old content, it's a <strong>caching problem</strong>. Caching is a speed optimization that saves copies of web pages to serve them faster — but it can show outdated content when not cleared properly.</p>
<p>There are multiple layers of cache that can each independently hold old content:</p>
<ul>
  <li><strong>Browser cache</strong> — Your browser saves page copies locally</li>
  <li><strong>WordPress caching plugin</strong> — Plugins like W3 Total Cache, WP Super Cache store static copies</li>
  <li><strong>Server-side cache</strong> — Some hosting optimizations cache at server level</li>
  <li><strong>CDN cache</strong> — If using Cloudflare or another CDN, they cache content globally</li>
</ul>

<h2>Step 1 — Clear Your Browser Cache</h2>
<p>The quickest test: press <strong>Ctrl + Shift + R</strong> (Windows) or <strong>Cmd + Shift + R</strong> (Mac) to hard-reload and bypass the browser cache. If you see the updated content after that, your browser was the culprit.</p>
<p>To clear all cached files:</p>
<ul>
  <li><strong>Chrome:</strong> Settings → Privacy → Clear Browsing Data → Cached images and files</li>
  <li><strong>Firefox:</strong> Settings → Privacy → Clear Data → Cached Web Content</li>
  <li><strong>Safari:</strong> Develop → Empty Caches</li>
</ul>
<p>Also try viewing your site in <strong>Incognito / Private mode</strong> — this always bypasses local cache.</p>

<h2>Step 2 — Clear WordPress Cache Plugin</h2>
<p>If you use a caching plugin, clear its cache from the WordPress dashboard:</p>
<h3>W3 Total Cache</h3>
<ol>
  <li>In WordPress admin, go to <strong>Performance → Dashboard</strong></li>
  <li>Click <strong>Empty All Caches</strong></li>
</ol>
<h3>WP Super Cache</h3>
<ol>
  <li>Go to <strong>Settings → WP Super Cache</strong></li>
  <li>Click <strong>Delete Cache</strong></li>
</ol>
<h3>WP Rocket</h3>
<ol>
  <li>Click the <strong>WP Rocket</strong> icon in the admin bar</li>
  <li>Select <strong>Clear Cache</strong></li>
</ol>
${SS("WordPress admin bar with WP Rocket — Clear Cache option highlighted")}

<h2>Step 3 — Clear Cloudflare Cache (if using CDN)</h2>
<p>If your domain uses Cloudflare:</p>
<ol>
  <li>Log in to your Cloudflare dashboard</li>
  <li>Select your domain</li>
  <li>Go to <strong>Caching → Configuration</strong></li>
  <li>Click <strong>Purge Everything</strong></li>
</ol>
${SS("Cloudflare caching page — Purge Everything button highlighted")}

<h2>Step 4 — Clear Server-Level Cache in cPanel</h2>
<p>Noehost uses LiteSpeed Web Server with optional caching. To clear it:</p>
<ol>
  <li>Log in to cPanel via your <a href="https://noehost.com">Noehost Client Area</a></li>
  <li>Look for <strong>LiteSpeed Cache</strong> or <strong>Cache Manager</strong> in the Software section</li>
  <li>Click <strong>Flush All</strong> or <strong>Clear Cache</strong></li>
</ol>
<p>Alternatively, if using the WordPress LiteSpeed Cache plugin:</p>
<ol>
  <li>In WordPress, go to <strong>LiteSpeed Cache → Dashboard</strong></li>
  <li>Click <strong>Purge All</strong></li>
</ol>

<h2>Step 5 — Disable Caching Temporarily for Testing</h2>
<p>To confirm caching is the issue, add this to your <code>.htaccess</code> temporarily to disable browser caching:</p>
<pre><code>&lt;IfModule mod_headers.c&gt;
  Header set Cache-Control "no-cache, no-store, must-revalidate"
  Header set Pragma "no-cache"
  Header set Expires 0
&lt;/IfModule&gt;</code></pre>
<p>If you see fresh content after adding this, caching was definitely the problem. Remove these lines after testing.</p>

<h2>Best Practice: Set Sensible Cache Durations</h2>
<p>Rather than disabling caching entirely (which slows your site), configure your caching plugin to:</p>
<ul>
  <li>Cache static assets (images, CSS, JS) for 30 days</li>
  <li>Cache HTML pages for 1–4 hours</li>
  <li>Always exclude WooCommerce cart pages and logged-in users from caching</li>
</ul>
<p>If you need help configuring caching correctly on Noehost, open a support ticket and our team will review your settings.</p>`,
    },

  ];

  await db.insert(kbArticlesTable).values(articles);
  console.log(`[KB] Seeded ${articles.length} articles across ${categories.length} categories`);
}

export default router;
