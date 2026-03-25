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
router.get("/api/kb/categories", async (_req, res) => {
  try {
    const categories = await db
      .select()
      .from(kbCategoriesTable)
      .where(eq(kbCategoriesTable.isPublished, true))
      .orderBy(asc(kbCategoriesTable.sortOrder), asc(kbCategoriesTable.name));

    // Get article counts per category
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
router.get("/api/kb/articles", async (req, res) => {
  try {
    const { q, categoryId, featured } = req.query as Record<string, string>;

    const articles = await db
      .select({
        id: kbArticlesTable.id,
        categoryId: kbArticlesTable.categoryId,
        title: kbArticlesTable.title,
        slug: kbArticlesTable.slug,
        excerpt: kbArticlesTable.excerpt,
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
router.get("/api/kb/articles/:slug", async (req, res) => {
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
        slug: kbArticlesTable.slug,
        excerpt: kbArticlesTable.excerpt,
      })
      .from(kbArticlesTable)
      .where(eq(kbArticlesTable.categoryId, article.categoryId))
      .limit(5);

    res.json({ ...article, views: article.views + 1, category, related: related.filter(r => r.id !== article.id) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

// ─── PUBLIC: submit feedback ──────────────────────────────────────────────────
router.post("/api/kb/articles/:id/feedback", async (req, res) => {
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
router.get("/api/admin/kb/categories", authenticate, requireRole("admin"), async (_req, res) => {
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
router.post("/api/admin/kb/categories", authenticate, requireRole("admin"), async (req, res) => {
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
router.put("/api/admin/kb/categories/:id", authenticate, requireRole("admin"), async (req, res) => {
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
router.delete("/api/admin/kb/categories/:id", authenticate, requireRole("admin"), async (req, res) => {
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
router.get("/api/admin/kb/articles", authenticate, requireRole("admin"), async (_req, res) => {
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
router.get("/api/admin/kb/articles/:id", authenticate, requireRole("admin"), async (req, res) => {
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
router.post("/api/admin/kb/articles", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { categoryId, title, content, excerpt, isFeatured, isPublished } = req.body;
    const slug = toSlug(title);

    const [article] = await db
      .insert(kbArticlesTable)
      .values({ categoryId, title, slug, content: content || "", excerpt, isFeatured: isFeatured ?? false, isPublished: isPublished ?? true })
      .returning();

    res.status(201).json(article);
  } catch (e: any) {
    if (e?.code === "23505") return res.status(400).json({ error: "An article with this title already exists" });
    console.error(e);
    res.status(500).json({ error: "Failed to create article" });
  }
});

// ─── ADMIN: update article ────────────────────────────────────────────────────
router.put("/api/admin/kb/articles/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryId, title, content, excerpt, isFeatured, isPublished } = req.body;

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (categoryId !== undefined) updates.categoryId = categoryId;
    if (title !== undefined) { updates.title = title; updates.slug = toSlug(title); }
    if (content !== undefined) updates.content = content;
    if (excerpt !== undefined) updates.excerpt = excerpt;
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
router.delete("/api/admin/kb/articles/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(kbArticlesTable).where(eq(kbArticlesTable.id, id));
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete article" });
  }
});

// ─── ADMIN: seed default KB content ──────────────────────────────────────────
router.post("/api/admin/kb/seed", authenticate, requireRole("admin"), async (_req, res) => {
  try {
    await seedKbContent();
    res.json({ ok: true, message: "Knowledge base seeded successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to seed knowledge base" });
  }
});

export async function seedKbContent() {
  const existingCats = await db.select().from(kbCategoriesTable).limit(1);
  if (existingCats.length > 0) return; // already seeded

  const categories = [
    { name: "Getting Started", slug: "getting-started", description: "New to NexGoHost? Start here.", icon: "Rocket", sortOrder: 1 },
    { name: "Hosting & Services", slug: "hosting-services", description: "Shared hosting, email, and service management.", icon: "Server", sortOrder: 2 },
    { name: "Domain Management", slug: "domain-management", description: "Registering, transferring, and managing domains.", icon: "Globe", sortOrder: 3 },
    { name: "Billing & Payments", slug: "billing-payments", description: "Invoices, payment methods, and refunds.", icon: "CreditCard", sortOrder: 4 },
    { name: "Account & Security", slug: "account-security", description: "Password, two-factor auth, and account settings.", icon: "Shield", sortOrder: 5 },
    { name: "Email & DNS", slug: "email-dns", description: "Configure email, DNS records, and mail troubleshooting.", icon: "Mail", sortOrder: 6 },
  ];

  const insertedCats = await db.insert(kbCategoriesTable).values(categories).returning();
  const catMap: Record<string, string> = {};
  for (const cat of insertedCats) catMap[cat.slug] = cat.id;

  const articles = [
    // Getting Started
    {
      categoryId: catMap["getting-started"],
      title: "How to Create Your NexGoHost Account",
      slug: "how-to-create-your-nexgohost-account",
      excerpt: "A step-by-step guide to signing up and activating your account.",
      isFeatured: true,
      content: `<h2>Creating Your Account</h2><p>Welcome to NexGoHost! Getting started is quick and easy. Follow these steps to create your account:</p><ol><li>Visit our homepage and click <strong>Get Started</strong> or <strong>Sign Up</strong>.</li><li>Fill in your full name, email address, and choose a strong password.</li><li>Click <strong>Create Account</strong>. You will receive a verification email shortly.</li><li>Open the email and click the verification link to activate your account.</li><li>Log in to your client portal and explore your dashboard.</li></ol><h2>What Happens Next?</h2><p>Once your account is active, you can:</p><ul><li>Order hosting, domains, or other services</li><li>Submit a support ticket if you need help</li><li>View and pay invoices from your billing dashboard</li></ul><p>If you have any trouble, open a support ticket and our team will help you right away.</p>`,
    },
    {
      categoryId: catMap["getting-started"],
      title: "Navigating Your Client Dashboard",
      slug: "navigating-your-client-dashboard",
      excerpt: "Learn what every section of your client area does.",
      isFeatured: true,
      content: `<h2>Your Dashboard Overview</h2><p>After logging in, you land on your main dashboard. Here is what each section means:</p><ul><li><strong>Services</strong> — Lists all your active hosting plans. Click any service to manage it.</li><li><strong>Domains</strong> — Shows all domains registered or transferred through NexGoHost.</li><li><strong>Invoices</strong> — View unpaid, paid, and upcoming invoices.</li><li><strong>Tickets</strong> — Open a new support request or view existing ones.</li><li><strong>Orders</strong> — Browse your order history.</li></ul><h2>Quick Actions</h2><p>From the dashboard you can quickly order new services, pay overdue invoices, and check the status of your support tickets.</p>`,
    },
    {
      categoryId: catMap["getting-started"],
      title: "How to Order a Hosting Plan",
      slug: "how-to-order-a-hosting-plan",
      excerpt: "Step-by-step guide to ordering your first hosting plan.",
      content: `<h2>Ordering Hosting</h2><p>Follow these steps to order a hosting plan:</p><ol><li>Log into your client area and click <strong>Order Services</strong> from the top menu or dashboard.</li><li>Browse the available hosting plans and click <strong>Select</strong> on the plan you want.</li><li>Choose whether you want a new domain, transfer an existing domain, or use a domain you already own.</li><li>Review your order in the cart and click <strong>Checkout</strong>.</li><li>Select your payment method (bank transfer or other options).</li><li>Confirm your order. You will receive an email with your login details once the service is activated.</li></ol><h2>When Does Activation Happen?</h2><p>Hosting services are typically activated within 1–24 hours after payment is confirmed. You will receive an email with your cPanel credentials once the account is live.</p>`,
    },
    // Hosting & Services
    {
      categoryId: catMap["hosting-services"],
      title: "How to Log in to cPanel",
      slug: "how-to-log-in-to-cpanel",
      excerpt: "Access your web hosting control panel using your cPanel credentials.",
      isFeatured: true,
      content: `<h2>Accessing cPanel</h2><p>cPanel is the control panel for managing your hosting account. Here is how to access it:</p><h3>Method 1: Direct URL</h3><p>Go to <code>http://yourdomain.com:2082</code> or <code>https://yourdomain.com:2083</code> (for SSL). Enter your cPanel username and password.</p><h3>Method 2: Through the Client Portal</h3><ol><li>Log in to your NexGoHost client area.</li><li>Go to <strong>Services</strong> and click on your hosting plan.</li><li>Click the <strong>Login to cPanel</strong> button — this logs you in automatically with no password needed.</li></ol><h2>First Time Login</h2><p>Your cPanel username and temporary password were emailed to you when your hosting was activated. If you cannot find the email, open a support ticket and we will resend it.</p>`,
    },
    {
      categoryId: catMap["hosting-services"],
      title: "How to Upload Files to Your Hosting",
      slug: "how-to-upload-files-to-your-hosting",
      excerpt: "Upload your website files using FTP or cPanel File Manager.",
      content: `<h2>Uploading Website Files</h2><p>There are two main ways to upload files to your hosting account:</p><h3>Option 1: cPanel File Manager</h3><ol><li>Log in to cPanel.</li><li>Click <strong>File Manager</strong> in the Files section.</li><li>Navigate to <code>public_html</code> — this is your website's root folder.</li><li>Click <strong>Upload</strong> and select your files.</li></ol><h3>Option 2: FTP Client (Recommended for Large Uploads)</h3><ol><li>Download an FTP client like <a href="https://filezilla-project.org">FileZilla</a> (free).</li><li>Log in with your cPanel username, your domain as the host, and port 21.</li><li>Drag and drop your files from your computer to the <code>public_html</code> folder.</li></ol><h2>Important Note</h2><p>Your main website files (index.html or index.php) must go directly inside the <code>public_html</code> folder, not inside a subfolder, unless you want the site at a subdirectory like <code>yourdomain.com/subfolder</code>.</p>`,
    },
    {
      categoryId: catMap["hosting-services"],
      title: "How to Create an Email Account on Your Hosting",
      slug: "how-to-create-an-email-account",
      excerpt: "Set up a professional @yourdomain.com email address using cPanel.",
      content: `<h2>Creating a Professional Email Address</h2><p>Having an email like <strong>info@yourdomain.com</strong> looks professional and builds trust. Here is how to create one:</p><ol><li>Log in to cPanel.</li><li>Under the <strong>Email</strong> section, click <strong>Email Accounts</strong>.</li><li>Click <strong>Create</strong>.</li><li>Choose your domain, enter the email username (e.g., "info", "sales", "support"), and set a strong password.</li><li>Click <strong>Create Account</strong>.</li></ol><h2>Accessing Your Email</h2><p>You can access your email in two ways:</p><ul><li><strong>Webmail:</strong> Go to <code>https://yourdomain.com/webmail</code> and log in with your full email and password.</li><li><strong>Email Client:</strong> Configure Outlook, Thunderbird, or your phone using IMAP/SMTP settings. Find these in cPanel under Email Accounts → Check Email.</li></ul>`,
    },
    {
      categoryId: catMap["hosting-services"],
      title: "How to Create a Subdomain",
      slug: "how-to-create-a-subdomain",
      excerpt: "Create a subdomain like blog.yourdomain.com in cPanel.",
      content: `<h2>What is a Subdomain?</h2><p>A subdomain is a prefix added to your domain. For example, <code>blog.yourdomain.com</code> or <code>shop.yourdomain.com</code>. You can use subdomains to host separate sections of your website.</p><h2>Creating a Subdomain</h2><ol><li>Log in to cPanel.</li><li>In the <strong>Domains</strong> section, click <strong>Subdomains</strong>.</li><li>Type the subdomain name (e.g., "blog") and select your main domain from the dropdown.</li><li>The document root will be filled automatically. You can change it if needed.</li><li>Click <strong>Create</strong>.</li></ol><p>Your new subdomain is now live. Upload your files to the document root folder shown.</p>`,
    },
    // Domain Management
    {
      categoryId: catMap["domain-management"],
      title: "How to Transfer a Domain to NexGoHost",
      slug: "how-to-transfer-a-domain-to-nexgohost",
      excerpt: "Transfer your existing domain to NexGoHost using your EPP/transfer authorization code.",
      isFeatured: true,
      content: `<h2>Domain Transfer Overview</h2><p>Transferring your domain to NexGoHost moves the registrar from your current provider to us. This does not affect your website or email during the transfer.</p><h2>Before You Start</h2><ul><li>Your domain must be at least 60 days old</li><li>The domain must be unlocked at your current registrar</li><li>Your WHOIS email must be accessible — you will receive a confirmation email</li><li>Obtain your EPP/authorization code (Auth Code) from your current registrar</li></ul><h2>Steps to Transfer</h2><ol><li>Log in to your NexGoHost client area.</li><li>Go to <strong>Domains</strong> and click <strong>Transfer a Domain</strong>.</li><li>Enter your domain name and click <strong>Check</strong>.</li><li>If eligible, enter your EPP/Auth Code and proceed to checkout.</li><li>Check your email for a transfer confirmation request and approve it.</li></ol><h2>How Long Does it Take?</h2><p>Domain transfers typically complete within 5–7 days. We will notify you by email when the transfer is approved and completed.</p>`,
    },
    {
      categoryId: catMap["domain-management"],
      title: "How to Update DNS Nameservers for Your Domain",
      slug: "how-to-update-dns-nameservers",
      excerpt: "Point your domain to your hosting by updating nameservers.",
      content: `<h2>What Are Nameservers?</h2><p>Nameservers tell the internet which server hosts your website. When you order hosting, you need to point your domain to our nameservers so visitors reach your site.</p><h2>Our Nameservers</h2><p>Use the nameservers provided in your hosting welcome email. They typically look like:</p><ul><li>ns1.nexgohost.com</li><li>ns2.nexgohost.com</li></ul><h2>How to Update Nameservers</h2><ol><li>Log in to wherever your domain is registered (NexGoHost, GoDaddy, Namecheap, etc.).</li><li>Find the DNS or Nameserver settings for your domain.</li><li>Replace the existing nameservers with ours.</li><li>Save your changes.</li></ol><h2>How Long Does it Take?</h2><p>DNS changes propagate globally in 24–72 hours. During this time your site may show the old content depending on where visitors are located.</p>`,
    },
    {
      categoryId: catMap["domain-management"],
      title: "What to Do if Your Domain is Locked and Cannot Be Transferred",
      slug: "domain-locked-cannot-transfer",
      excerpt: "Learn why your domain may be locked and how to unlock it for transfer.",
      content: `<h2>Why is My Domain Locked?</h2><p>Domain registrars lock domains by default to prevent unauthorized transfers. This is a security feature. You must unlock it before initiating a transfer.</p><h2>Common Lock Statuses</h2><ul><li><strong>clientTransferProhibited</strong> — Standard client lock. You can remove this from your registrar's control panel.</li><li><strong>serverTransferProhibited</strong> — Applied by the registry or registrar. You must contact your registrar to remove it.</li></ul><h2>How to Unlock Your Domain</h2><ol><li>Log in to your current domain registrar's control panel.</li><li>Find the domain and look for a <strong>Lock</strong> or <strong>Domain Lock</strong> setting.</li><li>Toggle it to <strong>Unlocked</strong>.</li><li>Wait a few minutes, then try the transfer again at NexGoHost.</li></ol><p>If you cannot unlock it yourself, contact your registrar's support team and ask them to remove the transfer prohibition.</p>`,
    },
    // Billing & Payments
    {
      categoryId: catMap["billing-payments"],
      title: "How to Pay an Invoice",
      slug: "how-to-pay-an-invoice",
      excerpt: "View and pay outstanding invoices in your NexGoHost client area.",
      isFeatured: true,
      content: `<h2>Paying Your Invoice</h2><ol><li>Log in to your NexGoHost client area.</li><li>Click <strong>Invoices</strong> from the left sidebar.</li><li>Find the invoice you want to pay and click on it.</li><li>Click <strong>Pay Invoice</strong>.</li><li>Select your payment method and follow the instructions to complete payment.</li></ol><h2>Available Payment Methods</h2><p>We currently accept:</p><ul><li>Bank Transfer (manual)</li><li>Other methods as configured by our team</li></ul><p>If you paid via bank transfer, please open a support ticket with your payment receipt so our team can verify and mark the invoice as paid.</p><h2>Invoice Not Showing?</h2><p>If you placed an order but do not see an invoice, please wait a few minutes and refresh the page. If the issue persists, contact support.</p>`,
    },
    {
      categoryId: catMap["billing-payments"],
      title: "Understanding Your Invoice",
      slug: "understanding-your-invoice",
      excerpt: "Learn what each line on your invoice means.",
      content: `<h2>Invoice Breakdown</h2><p>Each invoice includes the following details:</p><ul><li><strong>Invoice Number</strong> — A unique reference number for this invoice.</li><li><strong>Due Date</strong> — The date by which payment must be received to avoid service interruption.</li><li><strong>Line Items</strong> — Each service or product you are being billed for, with the period it covers.</li><li><strong>Subtotal</strong> — Total before any discounts.</li><li><strong>Discount</strong> — Promo code or other discount applied.</li><li><strong>Total</strong> — Amount due after discounts.</li></ul><h2>Late Payments</h2><p>Services may be suspended if invoices remain unpaid past their due date. To avoid disruption, pay promptly or contact us before the due date if you need extra time.</p>`,
    },
    {
      categoryId: catMap["billing-payments"],
      title: "How to Request a Refund",
      slug: "how-to-request-a-refund",
      excerpt: "Our refund policy and how to submit a refund request.",
      content: `<h2>Refund Policy</h2><p>We offer refunds in accordance with our terms of service. Generally:</p><ul><li>Shared hosting plans may be eligible for a refund within 30 days of activation.</li><li>Domain registrations are non-refundable once completed.</li><li>Add-on services may vary — check your service agreement.</li></ul><h2>How to Request a Refund</h2><ol><li>Log in to your client area.</li><li>Open a new support ticket under the <strong>Billing</strong> department.</li><li>Include your invoice number, the service you are requesting a refund for, and the reason.</li><li>Our billing team will review your request and respond within 1–3 business days.</li></ol><p>Approved refunds are processed back to your account credit or original payment method.</p>`,
    },
    // Account & Security
    {
      categoryId: catMap["account-security"],
      title: "How to Change Your Account Password",
      slug: "how-to-change-your-account-password",
      excerpt: "Update your password from the security settings page.",
      content: `<h2>Changing Your Password</h2><ol><li>Log in to your NexGoHost client area.</li><li>Click your name or profile icon in the top right.</li><li>Go to <strong>Security</strong> from the left menu.</li><li>Under <strong>Change Password</strong>, enter your current password, then your new password twice.</li><li>Click <strong>Update Password</strong>.</li></ol><h2>Password Requirements</h2><p>For your security, your password must be at least 8 characters and include a mix of letters, numbers, and symbols. Avoid using the same password you use on other sites.</p><h2>Forgot Your Password?</h2><p>If you cannot log in, click <strong>Forgot Password</strong> on the login page and enter your email. We will send you a reset link.</p>`,
    },
    {
      categoryId: catMap["account-security"],
      title: "How to Update Your Contact Information",
      slug: "how-to-update-your-contact-information",
      excerpt: "Keep your account details up to date.",
      content: `<h2>Updating Your Profile</h2><ol><li>Log in to your NexGoHost client area.</li><li>Click <strong>Profile</strong> or your name from the sidebar.</li><li>Update your name, email, phone number, or address as needed.</li><li>Click <strong>Save Changes</strong>.</li></ol><h2>Why This Matters</h2><p>We use your contact information to:</p><ul><li>Send invoices and payment receipts</li><li>Notify you about domain renewals and service expiry</li><li>Contact you if there is an issue with your account</li></ul><p>Keeping this information current ensures you never miss important communications.</p>`,
    },
    // Email & DNS
    {
      categoryId: catMap["email-dns"],
      title: "How to Set Up Email on Your Phone or Computer",
      slug: "how-to-set-up-email-on-your-device",
      excerpt: "Configure your hosting email in Outlook, Gmail, or any email app.",
      content: `<h2>Email Client Setup</h2><p>To receive your hosting email in an app like Outlook, Apple Mail, or Gmail, you need the following settings:</p><h3>Incoming Mail (IMAP)</h3><ul><li>Server: <code>mail.yourdomain.com</code></li><li>Port: 993 (SSL) or 143</li><li>Username: your full email address</li><li>Password: your email password</li></ul><h3>Outgoing Mail (SMTP)</h3><ul><li>Server: <code>mail.yourdomain.com</code></li><li>Port: 465 (SSL) or 587 (TLS)</li><li>Username: your full email address</li><li>Password: your email password</li><li>Authentication: Required</li></ul><h2>Finding Your Settings</h2><p>You can find your exact server settings by logging into cPanel, going to <strong>Email Accounts</strong>, and clicking <strong>Check Email</strong> next to your account. Then click <strong>Set Up Mail Client</strong> for automatic configuration files.</p>`,
    },
    {
      categoryId: catMap["email-dns"],
      title: "How to Add or Edit DNS Records",
      slug: "how-to-add-or-edit-dns-records",
      excerpt: "Manage A, CNAME, MX, TXT, and other DNS records for your domain.",
      content: `<h2>Editing DNS Records</h2><p>DNS records control how your domain works — which server it points to, where emails go, and more. To edit DNS records:</p><ol><li>Log in to cPanel.</li><li>In the <strong>Domains</strong> section, click <strong>Zone Editor</strong>.</li><li>Find your domain and click <strong>Manage</strong>.</li><li>Add, edit, or delete records as needed.</li><li>Click <strong>Save Record</strong> when done.</li></ol><h2>Common DNS Record Types</h2><ul><li><strong>A Record</strong> — Points your domain to an IP address.</li><li><strong>CNAME</strong> — Creates an alias (e.g., www → yourdomain.com).</li><li><strong>MX Record</strong> — Controls where emails are delivered.</li><li><strong>TXT Record</strong> — Used for email verification (SPF, DKIM) and domain ownership confirmation.</li></ul><p>Be careful when editing DNS records as incorrect settings can take your site or email offline. If unsure, open a support ticket and we will help.</p>`,
    },
  ];

  await db.insert(kbArticlesTable).values(articles);
}

export default router;
