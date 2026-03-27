import { getAppUrl } from "./lib/app-url.js";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import router from "./routes";
import { db } from "@workspace/db";
import { kbArticlesTable, kbCategoriesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { badBotMiddleware, ipBlockMiddleware } from "./lib/security.js";
import { safepayWebhookHandler } from "./routes/safepay.js";

const app: Express = express();

// ── CORS: allow noehost.com subdomains + Replit dev domains ───────────────────
const ALLOWED_ORIGINS = [
  /^https?:\/\/(client|cart|admin|www)\.noehost\.com$/,
  /^https?:\/\/noehost\.com$/,
  /\.replit\.dev$/,
  /\.repl\.co$/,
  /\.sisko\.replit\.dev$/,
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // non-browser requests (curl, mobile, etc.)
    const allowed = ALLOWED_ORIGINS.some(pattern => pattern.test(origin));
    cb(null, allowed ? origin : false);
  },
  credentials: true,
}));

// ── Subdomain context middleware ───────────────────────────────────────────────
// Detects the requesting subdomain and stamps req.subdomainContext so routes
// can tailor their response. Also handles X-Forwarded-Host from proxies.
app.use((req: Request, _res: Response, next: NextFunction) => {
  const host = (req.headers["x-forwarded-host"] as string) || req.hostname || "";
  let context: "client" | "cart" | "admin" | "main" = "main";
  if (host.startsWith("client.")) context = "client";
  else if (host.startsWith("cart.")) context = "cart";
  else if (host.startsWith("admin.")) context = "admin";
  (req as any).subdomainContext = context;
  next();
});

// ── Safepay webhook — MUST come before express.json() to receive raw Buffer body ──
// Safepay sends a HMAC-SHA256 signature over the raw request body;
// we need the unmodified bytes to verify it.
app.post(
  "/api/webhooks/safepay",
  express.raw({ type: "*/*" }),
  (req: Request, res: Response) => { safepayWebhookHandler(req, res); },
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Subdomain context endpoint — public, lightweight, no auth needed ──────────
// Must be BEFORE the security middleware so it's not blocked by the bot filter.
app.get("/api/subdomain-context", (req: Request, res: Response) => {
  const context = (req as any).subdomainContext ?? "main";
  const host = (req.headers["x-forwarded-host"] as string) || req.hostname || "";
  res.json({
    context,
    host,
    routes: {
      client: "client.noehost.com",
      cart:   "cart.noehost.com",
      admin:  "admin.noehost.com",
    },
  });
});

// ── Security middleware (bad bot blocker + IP block on auth routes) ────────────
app.use(badBotMiddleware);
app.use(ipBlockMiddleware);

app.use("/api", router);

// ── Sitemap.xml — Help Center KB articles for Google Search Console ────────────
app.get("/sitemap.xml", async (_req: Request, res: Response) => {
  try {
    const BASE_URL = getAppUrl();
    const articles = await db.select({
      slug: kbArticlesTable.slug,
      updatedAt: kbArticlesTable.updatedAt,
    }).from(kbArticlesTable).where(eq(kbArticlesTable.isPublished, true));

    const categories = await db.select({
      slug: kbCategoriesTable.slug,
    }).from(kbCategoriesTable);

    const now = new Date().toISOString().split("T")[0];

    const staticUrls = [
      { loc: `${BASE_URL}/`, priority: "1.0", changefreq: "weekly" },
      { loc: `${BASE_URL}/help`, priority: "0.9", changefreq: "weekly" },
    ];

    const categoryUrls = categories.map(c => ({
      loc: `${BASE_URL}/help?category=${c.slug}`,
      priority: "0.7",
      changefreq: "weekly",
    }));

    const articleUrls = articles.map(a => ({
      loc: `${BASE_URL}/help/${a.slug}`,
      priority: "0.8",
      changefreq: "monthly",
      lastmod: a.updatedAt ? new Date(a.updatedAt).toISOString().split("T")[0] : now,
    }));

    const allUrls = [...staticUrls, ...categoryUrls, ...articleUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${(u as any).lastmod || now}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err: any) {
    res.status(500).send(`<?xml version="1.0"?><error>${err.message}</error>`);
  }
});

// ── Global 404 handler — always return JSON ────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "Endpoint not found" });
});

// ── Global error handler — always return JSON ──────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[UNHANDLED ERROR]", err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";
  res.status(status).json({ success: false, message });
});

export default app;
