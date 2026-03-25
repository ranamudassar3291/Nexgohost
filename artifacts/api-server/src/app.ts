import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import router from "./routes";
import { db } from "@workspace/db";
import { kbArticlesTable, kbCategoriesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ── Sitemap.xml — Help Center KB articles for Google Search Console ────────────
app.get("/sitemap.xml", async (_req: Request, res: Response) => {
  try {
    const BASE_URL = "https://noehost.com";
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
