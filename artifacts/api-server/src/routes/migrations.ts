import { Router } from "express";
import { db } from "@workspace/db";
import { migrationsTable, usersTable, serversTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import {
  twentyiCreateHosting,
  twentyiGetSSOUrl,
  twentyiGetOrCreateStackUser,
  twentyiAssignSiteToUser,
  buildAuthHeader,
} from "../lib/twenty-i.js";
import https from "node:https";

const router = Router();

async function getAdminApiKey(): Promise<string | null> {
  try {
    const servers = await db.select().from(serversTable);
    const s = servers.find((sv: any) => sv.type === "20i");
    // Field is `apiToken` (Drizzle ORM camelCase) — NOT `apiKey`
    const key = (s as any)?.apiToken ?? null;
    if (key) console.log(`[MIGRATION-KEY] Using 20i key — len=${key.length}  last4=${key.slice(-4)}`);
    else console.warn("[MIGRATION-KEY] No 20i API key found — add it in Admin → Servers");
    return key;
  } catch {
    return null;
  }
}

function httpsRequest(url: string, options: https.RequestOptions, body?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { ...options, rejectUnauthorized: false }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ _raw: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function twentyiCpanelMigratePackage(
  apiKey: string,
  siteId: string,
  cpanelHost: string,
  cpanelUser: string,
  cpanelPassword: string,
): Promise<any> {
  const authHeader = buildAuthHeader(apiKey);
  const body = JSON.stringify({ host: cpanelHost, user: cpanelUser, pass: cpanelPassword });
  return httpsRequest(`https://api.20i.com/package/${siteId}/web/cpanelMigrate`, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
  }, body);
}

async function twentyiGetPackageMigrationStatus(apiKey: string, siteId: string): Promise<any> {
  try {
    const authHeader = buildAuthHeader(apiKey);
    return await httpsRequest(`https://api.20i.com/package/${siteId}/web/cpanelMigrate`, {
      method: "GET",
      headers: { Authorization: authHeader },
    });
  } catch (e: any) {
    return { error: e.message };
  }
}

function formatMigration(m: typeof migrationsTable.$inferSelect, clientName?: string) {
  return {
    id: m.id,
    clientId: m.clientId,
    clientName: clientName ?? "",
    domain: m.domain,
    oldHostingProvider: m.oldHostingProvider,
    oldCpanelHost: m.oldCpanelHost,
    oldCpanelUsername: m.oldCpanelUsername,
    sourceType: m.sourceType ?? "cpanel",
    whmAccount: m.whmAccount ?? null,
    twentyiJobId: m.twentyiJobId ?? null,
    twentyiSiteId: m.twentyiSiteId ?? null,
    status: m.status,
    progress: m.progress ?? 0,
    notes: m.notes ?? null,
    requestedAt: m.requestedAt.toISOString(),
    completedAt: m.completedAt?.toISOString() ?? null,
  };
}

// ─── Client: List WHM Accounts ────────────────────────────────────────────────
// GET /migrations/whm-accounts?host=&user=&password=&port=
router.get("/migrations/whm-accounts", authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user?.canMigrate) {
      res.status(403).json({ error: "Migration is not enabled for your account. Please contact support." });
      return;
    }

    const { host, user: whmUser, password, port = "2087" } = req.query as Record<string, string>;
    if (!host || !whmUser || !password) {
      res.status(400).json({ error: "host, user, and password are required" });
      return;
    }

    const creds = Buffer.from(`${whmUser}:${password}`).toString("base64");
    const data = await httpsRequest(`https://${host}:${port}/json-api/listaccts?api.version=1`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${creds}`,
        Accept: "application/json",
      },
    });

    if (data?.status === 0 || data?.error) {
      res.status(400).json({ error: data?.statusmsg ?? data?.error ?? "WHM returned an error" });
      return;
    }

    const accounts = (data?.data?.acct ?? []).map((a: any) => ({
      user: a.user,
      domain: a.domain,
      email: a.email ?? "",
      diskUsed: a.diskused ?? "",
      plan: a.plan ?? "",
    }));
    res.json({ accounts });
  } catch (err: any) {
    console.error("[WHM list accounts]", err.message);
    res.status(500).json({ error: `Failed to connect to WHM: ${err.message}` });
  }
});

// ─── Client: Get my migrations ─────────────────────────────────────────────────
router.get("/migrations", authenticate, async (req: AuthRequest, res) => {
  try {
    const migrations = await db
      .select()
      .from(migrationsTable)
      .where(eq(migrationsTable.clientId, req.user!.userId))
      .orderBy(sql`requested_at DESC`);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    res.json(migrations.map(m => formatMigration(m, user ? `${user.firstName} ${user.lastName}` : "")));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Client: Start migration (with 20i integration) ──────────────────────────
// POST /migrations/start
router.post("/migrations/start", authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (!user.canMigrate) {
      res.status(403).json({ error: "Migration is not enabled for your account. Please contact support." });
      return;
    }

    const {
      domain,
      sourceType = "cpanel",
      host,
      username,
      password,
      whmAccount,
      notes,
      oldHostingProvider,
    } = req.body;

    if (!domain || !host || !username || !password) {
      res.status(400).json({ error: "domain, host, username, and password are required" });
      return;
    }

    const [migration] = await db.insert(migrationsTable).values({
      clientId: req.user!.userId,
      domain,
      oldHostingProvider: oldHostingProvider || host,
      oldCpanelHost: host,
      oldCpanelUsername: username,
      oldCpanelPassword: password,
      sourceType: sourceType as "cpanel" | "whm",
      whmAccount: whmAccount || null,
      status: "in_progress",
      progress: 5,
      notes: notes || null,
    }).returning();

    res.status(201).json(formatMigration(migration, `${user.firstName} ${user.lastName}`));

    setImmediate(async () => {
      try {
        const apiKey = await getAdminApiKey();
        if (!apiKey) {
          console.warn("[Migration] No 20i API key found — skipping 20i provisioning");
          return;
        }

        const { siteId } = await twentyiCreateHosting(apiKey, domain, user.email);
        if (!siteId) throw new Error("20i did not return a site ID");

        let stackUserId = user.stackUserId;
        if (!stackUserId) {
          const stackUser = await twentyiGetOrCreateStackUser(
            apiKey, user.email, `${user.firstName} ${user.lastName}`
          );
          stackUserId = stackUser.id;
          await db.update(usersTable)
            .set({ stackUserId, updatedAt: new Date() })
            .where(eq(usersTable.id, user.id));
        }
        await twentyiAssignSiteToUser(apiKey, siteId, stackUserId);

        const cpanelUser = whmAccount || username;
        await twentyiCpanelMigratePackage(apiKey, siteId, host, cpanelUser, password);

        await db.update(migrationsTable)
          .set({ twentyiSiteId: siteId, progress: 20, status: "in_progress" })
          .where(eq(migrationsTable.id, migration.id));

        console.log(`[Migration] 20i migration triggered: site=${siteId} domain=${domain}`);
      } catch (e: any) {
        console.error("[Migration 20i background]", e.message);
        await db.update(migrationsTable)
          .set({ notes: `20i provisioning error: ${e.message}`, status: "in_progress" })
          .where(eq(migrationsTable.id, migration.id));
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Client: Legacy simple migration request ──────────────────────────────────
router.post("/migrations", authenticate, async (req: AuthRequest, res) => {
  try {
    const { domain, oldHostingProvider, oldCpanelHost, oldCpanelUsername, oldCpanelPassword, notes } = req.body;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [migration] = await db.insert(migrationsTable).values({
      clientId: req.user!.userId,
      domain,
      oldHostingProvider,
      oldCpanelHost,
      oldCpanelUsername,
      oldCpanelPassword,
      notes,
      status: "pending",
      progress: 0,
    }).returning();

    res.status(201).json(formatMigration(migration, `${user.firstName} ${user.lastName}`));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Client: Poll migration status (polls 20i + updates DB) ─────────────────
router.get("/migrations/:id/status", authenticate, async (req: AuthRequest, res) => {
  try {
    const [migration] = await db.select().from(migrationsTable)
      .where(eq(migrationsTable.id, req.params.id)).limit(1);

    if (!migration) { res.status(404).json({ error: "Not found" }); return; }
    if (migration.clientId !== req.user!.userId && req.user!.role !== "admin") {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    let twentyiStatus: any = null;

    if (migration.twentyiSiteId && migration.status !== "completed" && migration.status !== "failed") {
      const apiKey = await getAdminApiKey();
      if (apiKey) {
        twentyiStatus = await twentyiGetPackageMigrationStatus(apiKey, migration.twentyiSiteId);
        const rawStatus = twentyiStatus?.status ?? twentyiStatus?.state ?? twentyiStatus?.result ?? "";
        let newProgress = migration.progress ?? 20;
        let newStatus: string = migration.status;

        if (rawStatus !== null && rawStatus !== undefined) {
          const s = String(rawStatus).toLowerCase();
          if (s.includes("complet") || s.includes("finish") || s.includes("done") || rawStatus === 1 || rawStatus === "1") {
            newProgress = 100;
            newStatus = "completed";
          } else if (s.includes("fail") || s.includes("error") || s.includes("abort")) {
            newStatus = "failed";
          } else if (s.includes("progress") || s.includes("run") || s.includes("pending") || s.includes("queue")) {
            newProgress = Math.min(newProgress + 10, 90);
          }
        }

        if (newProgress !== (migration.progress ?? 0) || newStatus !== migration.status) {
          await db.update(migrationsTable).set({
            progress: newProgress,
            status: newStatus as any,
            completedAt: newStatus === "completed" ? new Date() : undefined,
          }).where(eq(migrationsTable.id, migration.id));
        }
      }
    }

    const [updated] = await db.select().from(migrationsTable)
      .where(eq(migrationsTable.id, req.params.id)).limit(1);
    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.id, migration.clientId)).limit(1);

    res.json({
      migration: formatMigration(updated!, user ? `${user.firstName} ${user.lastName}` : ""),
      twentyiStatus,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Client: Get StackCP SSO URL ──────────────────────────────────────────────
router.get("/migrations/:id/stackcp-url", authenticate, async (req: AuthRequest, res) => {
  try {
    const [migration] = await db.select().from(migrationsTable)
      .where(eq(migrationsTable.id, req.params.id)).limit(1);

    if (!migration) { res.status(404).json({ error: "Not found" }); return; }
    if (migration.clientId !== req.user!.userId && req.user!.role !== "admin") {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    if (!migration.twentyiSiteId) {
      res.status(400).json({ error: "No hosting package linked to this migration yet." }); return;
    }

    const apiKey = await getAdminApiKey();
    if (!apiKey) { res.status(503).json({ error: "20i is not configured" }); return; }

    const url = await twentyiGetSSOUrl(apiKey, migration.twentyiSiteId);
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Get all migrations ─────────────────────────────────────────────────
router.get("/admin/migrations", authenticate, requireAdmin, async (_req, res) => {
  try {
    const migrations = await db.select().from(migrationsTable).orderBy(sql`requested_at DESC`);
    const result = await Promise.all(migrations.map(async (m) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, m.clientId)).limit(1);
      return formatMigration(m, user ? `${user.firstName} ${user.lastName}` : "");
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Admin: Update migration status ───────────────────────────────────────────
router.put("/admin/migrations/:id/status", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { status, progress, notes } = req.body;
    const completedAt = (status === "completed" || status === "failed") ? new Date() : undefined;

    const [updated] = await db.update(migrationsTable)
      .set({
        status,
        progress: progress !== undefined ? progress : undefined,
        notes: notes !== undefined ? notes : undefined,
        completedAt,
      })
      .where(eq(migrationsTable.id, req.params.id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    res.json(formatMigration(updated, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
