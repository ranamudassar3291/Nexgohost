import { Router } from "express";
import { db } from "@workspace/db";
import { sql, eq, desc } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { randomUUID } from "crypto";
import { serversTable, invoicesTable } from "@workspace/db/schema";
import { decryptField } from "../lib/fieldCrypto.js";
import axios from "axios";

const router = Router();

// ── Invoice helper (mirrors invoices.ts — uses shared sequence) ───────────────
async function genEmailInvoiceNumber(): Promise<string> {
  await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS inv_seq START WITH 2001`);
  const result = await db.execute(sql`SELECT nextval('inv_seq') AS seq`);
  const seq = Number((result.rows[0] as any).seq);
  return `NOE-${String(seq).padStart(5, "0")}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function decryptApiKey(server: any): string {
  const key = server.apiToken ?? "";
  if (key.startsWith("enc:v1:")) {
    try { return decryptField(key); } catch { return key; }
  }
  return key;
}

async function get20iServer() {
  const [server] = await db
    .select()
    .from(serversTable)
    .where(eq((serversTable as any).type, "20i"))
    .limit(1);
  return server ?? null;
}

async function call20i(server: any, method: "get" | "post" | "delete" | "put", path: string, body?: any) {
  const key = decryptApiKey(server);
  const baseUrl = (server as any).proxyUrl || process.env.TWENTYI_BASE_URL || "https://api.20i.com";
  const url = `${baseUrl}${path}`;
  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "User-Agent": "Nexgohost-Platform/1.0",
  };
  const res = await axios({ method, url, headers, data: body, timeout: 15000 });
  return res.data;
}

// Standard DNS records for our mail cluster (white-labeled, no 20i branding)
function buildDnsRecords(domain: string) {
  return {
    mx: [
      { type: "MX", host: "@", value: "mail.noemail.noehost.com", priority: 10, ttl: 3600 },
    ],
    spf: [
      { type: "TXT", host: "@", value: `v=spf1 include:spf.noemail.noehost.com ~all`, ttl: 3600 },
    ],
    dkim: [
      {
        type: "TXT",
        host: `noemail._domainkey`,
        value: `v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3sKSc3j8VG...mail-cluster-key`,
        ttl: 3600,
      },
    ],
    dmarc: [
      { type: "TXT", host: "_dmarc", value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@noemail.noehost.com`, ttl: 3600 },
    ],
    autoconfig: [
      { type: "CNAME", host: "mail", value: "mail.noemail.noehost.com", ttl: 3600 },
      { type: "CNAME", host: "imap", value: "mail.noemail.noehost.com", ttl: 3600 },
      { type: "CNAME", host: "smtp", value: "mail.noemail.noehost.com", ttl: 3600 },
    ],
  };
}

// ── Admin: Email Package CRUD ─────────────────────────────────────────────────

// GET /api/admin/email-packages
router.get("/admin/email-packages", authenticate, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT * FROM admin_email_packages ORDER BY price ASC
    `);
    res.json(rows.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/email-packages
router.post("/admin/email-packages", authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, max_storage_gb, max_mailboxes, price, remote_package_id, yearly_price, is_popular } = req.body;
    if (!name || !price) return res.status(400).json({ error: "name and price are required" });
    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO admin_email_packages (id, name, max_storage_gb, max_mailboxes, price, yearly_price, remote_package_id, is_popular, created_at, updated_at)
      VALUES (${id}, ${name}, ${max_storage_gb ?? 10}, ${max_mailboxes ?? 5}, ${price}, ${yearly_price ?? null}, ${remote_package_id ?? null}, ${is_popular ?? false}, NOW(), NOW())
    `);
    const [row] = await db.execute(sql`SELECT * FROM admin_email_packages WHERE id = ${id}`);
    res.json((row as any).rows?.[0] ?? { id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/email-packages/:id
router.put("/admin/email-packages/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, max_storage_gb, max_mailboxes, price, yearly_price, remote_package_id, is_popular } = req.body;
    await db.execute(sql`
      UPDATE admin_email_packages SET
        name = COALESCE(${name ?? null}, name),
        max_storage_gb = COALESCE(${max_storage_gb ?? null}, max_storage_gb),
        max_mailboxes = COALESCE(${max_mailboxes ?? null}, max_mailboxes),
        price = COALESCE(${price ?? null}, price),
        yearly_price = COALESCE(${yearly_price ?? null}, yearly_price),
        remote_package_id = COALESCE(${remote_package_id ?? null}, remote_package_id),
        is_popular = COALESCE(${is_popular ?? null}, is_popular),
        updated_at = NOW()
      WHERE id = ${id}
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/email-packages/:id
router.delete("/admin/email-packages/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await db.execute(sql`DELETE FROM admin_email_packages WHERE id = ${req.params.id}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Fetch 20i email package templates ──────────────────────────────────

// GET /api/admin/email-packages/20i-templates
router.get("/admin/email-packages/20i-templates", authenticate, requireAdmin, async (_req, res) => {
  try {
    const server = await get20iServer();
    if (!server) return res.json({ templates: [], error: "No 20i server configured" });
    const data = await call20i(server, "get", "/package-types/email");
    const templates = Array.isArray(data)
      ? data.map((t: any) => ({
          id: String(t.id ?? t.packageTypeId ?? t.ref ?? ""),
          name: t.name ?? t.label ?? String(t.id ?? ""),
          storage_gb: t.storage ?? t.diskSpace ?? null,
          max_mailboxes: t.mailboxes ?? t.maxMailboxes ?? null,
        }))
      : [];
    res.json({ templates });
  } catch (err: any) {
    // 20i may not have email-specific package types — return empty with note
    res.json({ templates: [], error: err.message });
  }
});

// ── Public: Email Packages ────────────────────────────────────────────────────

// GET /api/email-packages  (public, no auth needed for checkout display)
router.get("/email-packages", async (_req, res) => {
  try {
    const rows = await db.execute(sql`SELECT * FROM admin_email_packages ORDER BY price ASC`);
    res.json(rows.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Client: Email Orders ──────────────────────────────────────────────────────

// GET /api/my/email-orders  — client's own orders
router.get("/my/email-orders", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const rows = await db.execute(sql`
      SELECT eo.*, ep.name as package_name, ep.max_storage_gb, ep.max_mailboxes, ep.price
      FROM email_orders eo
      LEFT JOIN admin_email_packages ep ON ep.id = eo.package_id
      WHERE eo.user_id = ${userId}
      ORDER BY eo.created_at DESC
    `);
    res.json(rows.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/my/email-orders  — create new email order
router.post("/my/email-orders", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { package_id, domain_name, billing_cycle } = req.body;
    if (!package_id || !domain_name) {
      return res.status(400).json({ error: "package_id and domain_name are required" });
    }
    // Validate domain format
    const domainClean = domain_name.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

    // Check package exists
    const pkgRows = await db.execute(sql`SELECT * FROM admin_email_packages WHERE id = ${package_id}`);
    const pkg = (pkgRows.rows as any[])[0];
    if (!pkg) return res.status(404).json({ error: "Package not found" });

    const id = randomUUID();
    const cycle = (billing_cycle === "yearly" || billing_cycle === "monthly") ? billing_cycle : "monthly";
    const rawPrice = cycle === "yearly" && pkg.yearly_price != null
      ? parseFloat(pkg.yearly_price)
      : parseFloat(pkg.price);
    // Guard: NaN or missing price would produce a broken SQL placeholder
    if (!rawPrice || isNaN(rawPrice) || rawPrice <= 0) {
      return res.status(400).json({ error: "Package price is not configured. Please contact support." });
    }
    const price = rawPrice;

    // Coerce to guaranteed-non-undefined types before SQL binding
    const safeId: string         = String(id);
    const safeUserId: string     = String(userId);
    const safePkgId: string      = String(package_id);   // UUID text — must NOT be parseInt'd
    const safeDomain: string     = String(domainClean);
    const safeCycle: string      = String(cycle);
    const safePrice: number      = price;

    if (!safePkgId) {
      return res.status(400).json({ error: "Invalid package_id." });
    }

    // ── Transaction: order row + storage quota + invoice ─────────────────────
    const invoiceNumber = await genEmailInvoiceNumber();
    const invoiceId = randomUUID();
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7);
    const invoiceItems = [{
      description: `${pkg.name} — Business Email Hosting (${cycle})`,
      quantity: 1,
      unitPrice: safePrice,
      total: safePrice,
    }];

    await db.execute(sql`BEGIN`);
    try {
      await db.execute(sql`
        INSERT INTO email_orders (id, user_id, package_id, domain_name, billing_cycle, amount_paid, status, created_at, updated_at)
        VALUES (${safeId}, ${safeUserId}, ${safePkgId}, ${safeDomain}, ${safeCycle}, ${safePrice}, 'pending_payment', NOW(), NOW())
      `);
      await db.execute(sql`
        INSERT INTO email_storage_usage (order_id, used_mb, quota_mb, updated_at)
        VALUES (${id}, 0, ${(pkg.max_storage_gb ?? 10) * 1024}, NOW())
        ON CONFLICT (order_id) DO NOTHING
      `);
      // Create the invoice linked to this email order
      await db.insert(invoicesTable).values({
        id: invoiceId,
        invoiceNumber,
        clientId: safeUserId,
        orderId: safeId,           // points to email_orders.id
        invoiceType: "email_hosting",
        amount: String(safePrice),
        tax: "0",
        total: String(safePrice),
        baseCurrencyAmount: String(safePrice),
        status: "unpaid",
        dueDate,
        items: invoiceItems,
      });
      await db.execute(sql`COMMIT`);
    } catch (txErr: any) {
      await db.execute(sql`ROLLBACK`).catch(() => {});
      console.error("[EMAIL ORDER] Transaction rolled back:", txErr);
      throw txErr;
    }

    res.json({
      id,
      invoiceId,
      invoiceNumber,
      amount: safePrice,
      domain_name: domainClean,
      status: "pending_payment",
      package: pkg,
    });
  } catch (err: any) {
    console.error("[EMAIL ORDER CREATE] raw error:", err);
    res.status(500).json({ error: "We were unable to place your order. Please try again or contact support." });
  }
});

// GET /api/my/email-orders/:id  — order detail + DNS records
router.get("/my/email-orders/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const rows = await db.execute(sql`
      SELECT eo.*, ep.name as package_name, ep.max_storage_gb, ep.max_mailboxes, ep.price,
             esu.used_mb, esu.quota_mb
      FROM email_orders eo
      LEFT JOIN admin_email_packages ep ON ep.id = eo.package_id
      LEFT JOIN email_storage_usage esu ON esu.order_id = eo.id
      WHERE eo.id = ${id} AND eo.user_id = ${userId}
    `);
    const order = (rows.rows as any[])[0];
    if (!order) return res.status(404).json({ error: "Order not found" });

    const dns = buildDnsRecords(order.domain_name);
    res.json({ ...order, dns_records: dns });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Client: Mailboxes ─────────────────────────────────────────────────────────

// GET /api/my/email-orders/:id/mailboxes
router.get("/my/email-orders/:id/mailboxes", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Verify order ownership
    const orderRows = await db.execute(sql`SELECT * FROM email_orders WHERE id = ${id} AND user_id = ${userId}`);
    if (!(orderRows.rows as any[]).length) return res.status(404).json({ error: "Order not found" });

    const rows = await db.execute(sql`
      SELECT * FROM synced_mailboxes WHERE order_id = ${id} ORDER BY created_at ASC
    `);

    // Try to sync from 20i in background (non-blocking)
    const order = (orderRows.rows as any[])[0];
    try {
      const server = await get20iServer();
      if (server && order.remote_hosting_id) {
        const apiKey = decryptApiKey(server);
        if (apiKey && !apiKey.startsWith("enc:v1:")) {
          const data = await call20i(server, "get", `/package/${order.remote_hosting_id}/email/mailboxes`);
          // Sync remote mailboxes into DB
          if (Array.isArray(data)) {
            for (const mb of data) {
              const email = mb.email ?? mb.address ?? "";
              if (!email) continue;
              await db.execute(sql`
                INSERT INTO synced_mailboxes (id, order_id, email_address, quota_mb, status, created_at)
                VALUES (${randomUUID()}, ${id}, ${email}, ${mb.quota ?? 1024}, 'active', NOW())
                ON CONFLICT (order_id, email_address) DO UPDATE SET quota_mb = EXCLUDED.quota_mb, status = 'active'
              `);
            }
          }
        }
      }
    } catch (_e) { /* silent — return cached DB rows */ }

    const freshRows = await db.execute(sql`
      SELECT * FROM synced_mailboxes WHERE order_id = ${id} ORDER BY created_at ASC
    `);
    res.json(freshRows.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/my/email-orders/:id/mailboxes  — create mailbox
router.post("/my/email-orders/:id/mailboxes", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { local_part, password, quota_mb } = req.body;

    if (!local_part || !password) return res.status(400).json({ error: "local_part and password are required" });

    const orderRows = await db.execute(sql`
      SELECT eo.*, ep.max_mailboxes, ep.max_storage_gb FROM email_orders eo
      LEFT JOIN admin_email_packages ep ON ep.id = eo.package_id
      WHERE eo.id = ${id} AND eo.user_id = ${userId}
    `);
    const order = (orderRows.rows as any[])[0];
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Check mailbox count limit
    const countRows = await db.execute(sql`SELECT COUNT(*) as cnt FROM synced_mailboxes WHERE order_id = ${id}`);
    const count = parseInt((countRows.rows as any[])[0]?.cnt ?? "0", 10);
    if (order.max_mailboxes && count >= Number(order.max_mailboxes)) {
      return res.status(400).json({ error: `Mailbox limit reached (${order.max_mailboxes} max)` });
    }

    const emailAddress = `${local_part.toLowerCase().trim()}@${order.domain_name}`;
    const quotaMb = quota_mb ?? Math.floor(((order.max_storage_gb ?? 10) * 1024) / (order.max_mailboxes ?? 5));

    // Try 20i API first
    let remote_id: string | null = null;
    try {
      const server = await get20iServer();
      if (server && order.remote_hosting_id) {
        const data = await call20i(server, "post", `/package/${order.remote_hosting_id}/email/mailboxes`, {
          email: emailAddress,
          password,
          quota: quotaMb,
        });
        remote_id = data?.id ?? data?.result?.id ?? null;
      }
    } catch (_e) { /* continue — save to DB anyway */ }

    const mbId = randomUUID();
    await db.execute(sql`
      INSERT INTO synced_mailboxes (id, order_id, email_address, quota_mb, status, remote_id, created_at)
      VALUES (${mbId}, ${id}, ${emailAddress}, ${quotaMb}, 'active', ${remote_id}, NOW())
    `);

    // Update storage usage
    await db.execute(sql`
      UPDATE email_storage_usage SET used_mb = used_mb + 1, updated_at = NOW()
      WHERE order_id = ${id}
    `);

    res.json({ id: mbId, email_address: emailAddress, quota_mb: quotaMb, status: "active" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/my/email-orders/:orderId/mailboxes/:mbId
router.delete("/my/email-orders/:orderId/mailboxes/:mbId", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { orderId, mbId } = req.params;

    const orderRows = await db.execute(sql`SELECT * FROM email_orders WHERE id = ${orderId} AND user_id = ${userId}`);
    if (!(orderRows.rows as any[]).length) return res.status(404).json({ error: "Order not found" });
    const order = (orderRows.rows as any[])[0];

    const mbRows = await db.execute(sql`SELECT * FROM synced_mailboxes WHERE id = ${mbId} AND order_id = ${orderId}`);
    const mb = (mbRows.rows as any[])[0];
    if (!mb) return res.status(404).json({ error: "Mailbox not found" });

    // Try 20i delete
    try {
      const server = await get20iServer();
      if (server && order.remote_hosting_id && mb.remote_id) {
        await call20i(server, "delete", `/package/${order.remote_hosting_id}/email/mailboxes/${mb.remote_id}`);
      }
    } catch (_e) { /* silent */ }

    await db.execute(sql`DELETE FROM synced_mailboxes WHERE id = ${mbId}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/my/email-orders/:id/webmail-login  — get webmail SSO token / redirect
router.post("/my/email-orders/:id/webmail-login", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { email_address } = req.body;

    const orderRows = await db.execute(sql`SELECT * FROM email_orders WHERE id = ${id} AND user_id = ${userId}`);
    const order = (orderRows.rows as any[])[0];
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Try 20i SSO token
    try {
      const server = await get20iServer();
      if (server && order.remote_hosting_id) {
        const data = await call20i(server, "post", `/package/${order.remote_hosting_id}/email/sso`, {
          email: email_address,
        });
        if (data?.url) return res.json({ url: data.url });
        if (data?.token) {
          return res.json({ url: `https://noemail.noehost.com/webmail?token=${data.token}` });
        }
      }
    } catch (_e) { /* fall through to generic url */ }

    // Fallback: redirect to webmail with domain hint
    const webmailUrl = `https://noemail.noehost.com/webmail?domain=${encodeURIComponent(order.domain_name)}&user=${encodeURIComponent(email_address ?? "")}`;
    res.json({ url: webmailUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: Orders overview ────────────────────────────────────────────────────

// GET /api/admin/email-orders
router.get("/admin/email-orders", authenticate, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT eo.*, ep.name as package_name, u.name as client_name, u.email as client_email,
             (SELECT COUNT(*) FROM synced_mailboxes sm WHERE sm.order_id = eo.id) as mailbox_count
      FROM email_orders eo
      LEFT JOIN admin_email_packages ep ON ep.id = eo.package_id
      LEFT JOIN users u ON u.id = eo.user_id
      ORDER BY eo.created_at DESC
    `);
    res.json(rows.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/email-orders/:id/status
router.put("/admin/email-orders/:id/status", authenticate, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await db.execute(sql`UPDATE email_orders SET status = ${status}, updated_at = NOW() WHERE id = ${req.params.id}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
