import app from "./app";
import { decryptField } from "./lib/fieldCrypto.js";
import { refreshExchangeRates } from "./routes/currencies.js";
import { runAllCronTasks, runTwentyiHealthCheck } from "./lib/cron.js";
import { seedMissingTemplates } from "./routes/email-templates.js";
import { seedVpsData } from "./lib/seedVps.js";
import { seedKbContent } from "./routes/kb.js";
import { initWhatsApp } from "./lib/whatsapp.js";
import { autoFixSafepayKeys } from "./routes/safepay.js";
import { getSystemApiKey } from "./lib/systemApiKey.js";
import { twentyiFindWorkingKeyFormat, setCachedKeyFormat, sanitiseKey } from "./lib/twenty-i.js";
import { db } from "@workspace/db";
import { serversTable } from "@workspace/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";

async function runStartupMigrations() {
  try {
    // Ensure cart_items table has all required columns (safe ADD COLUMN IF NOT EXISTS)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cart_items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        plan_name TEXT NOT NULL,
        item_type TEXT DEFAULT 'hosting',
        billing_cycle TEXT NOT NULL DEFAULT 'monthly',
        monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0,
        quarterly_price NUMERIC(10,2),
        semiannual_price NUMERIC(10,2),
        yearly_price NUMERIC(10,2),
        renewal_price NUMERIC(10,2),
        renewal_enabled TEXT DEFAULT 'false',
        domain_name TEXT,
        tld TEXT,
        added_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    // Add any missing columns to existing cart_items table
    const cartCols = [
      "ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'hosting'",
      "ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS quarterly_price NUMERIC(10,2)",
      "ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS semiannual_price NUMERIC(10,2)",
      "ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS yearly_price NUMERIC(10,2)",
      "ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS renewal_price NUMERIC(10,2)",
      "ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS renewal_enabled TEXT DEFAULT 'false'",
      "ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS domain_name TEXT",
      "ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS tld TEXT",
      "ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()",
    ];
    for (const stmt of cartCols) {
      await db.execute(sql.raw(stmt));
    }
    console.log("[MIGRATIONS] cart_items schema up to date");

    // email_account_settings table — persists spam/forward prefs per email address
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS email_account_settings (
        id TEXT PRIMARY KEY,
        hosting_service_id TEXT NOT NULL,
        email TEXT NOT NULL,
        spam_filter BOOLEAN NOT NULL DEFAULT TRUE,
        auto_forward BOOLEAN NOT NULL DEFAULT FALSE,
        forward_to TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(hosting_service_id, email)
      )
    `);
    console.log("[MIGRATIONS] email_account_settings table ready");

    // site_health_snapshots — historical performance data per hosting service
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS site_health_snapshots (
        id          SERIAL PRIMARY KEY,
        service_id  TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        uptime_pct  NUMERIC(5,2) NOT NULL DEFAULT 99.90,
        ssl_status  TEXT NOT NULL DEFAULT 'active',
        speed_score INTEGER NOT NULL DEFAULT 85,
        cpu_pct     NUMERIC(5,2) NOT NULL DEFAULT 10,
        ram_pct     NUMERIC(5,2) NOT NULL DEFAULT 25,
        disk_pct    NUMERIC(5,2) NOT NULL DEFAULT 10,
        bw_pct      NUMERIC(5,2) NOT NULL DEFAULT 5,
        recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_shs_service ON site_health_snapshots(service_id, recorded_at DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_shs_user    ON site_health_snapshots(user_id,    recorded_at DESC)`);
    console.log("[MIGRATIONS] site_health_snapshots table ready");

    // ── Secure Team Access tables ─────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS team_members (
        id              TEXT PRIMARY KEY,
        owner_user_id   TEXT NOT NULL,
        email           TEXT NOT NULL,
        name            TEXT NOT NULL,
        role            TEXT NOT NULL DEFAULT 'support_only',
        status          TEXT NOT NULL DEFAULT 'active',
        created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_team_members_owner ON team_members(owner_user_id)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_email ON team_members(owner_user_id, email)`);
    console.log("[MIGRATIONS] team_members table ready");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS team_magic_links (
        id              TEXT PRIMARY KEY,
        owner_user_id   TEXT NOT NULL,
        token           TEXT NOT NULL UNIQUE,
        label           TEXT NOT NULL DEFAULT 'Developer Access',
        expires_at      TIMESTAMP NOT NULL,
        used_at         TIMESTAMP,
        used_ip         TEXT,
        created_at      TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_team_links_owner ON team_magic_links(owner_user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_team_links_token ON team_magic_links(token)`);
    console.log("[MIGRATIONS] team_magic_links table ready");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS team_access_logs (
        id              TEXT PRIMARY KEY,
        owner_user_id   TEXT NOT NULL,
        actor_email     TEXT NOT NULL,
        actor_role      TEXT NOT NULL DEFAULT 'developer',
        ip_address      TEXT NOT NULL,
        action          TEXT NOT NULL,
        user_agent      TEXT,
        created_at      TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_team_logs_owner ON team_access_logs(owner_user_id, created_at DESC)`);
    console.log("[MIGRATIONS] team_access_logs table ready");
  } catch (err: any) {
    console.warn("[MIGRATIONS] Startup migration warning (non-fatal):", err.message);
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);

  // Run DB startup migrations (idempotent — safe to run on every start)
  runStartupMigrations().catch(() => {});

  // Detect the correct 20i key format on startup and cache it for the session.
  // All API calls then use the right key portion without re-detecting each time.
  (async () => {
    try {
      const [server] = await db.select().from(serversTable)
        .where(and(eq(serversTable.type, "20i"), eq(serversTable.status, "active")))
        .orderBy(desc(serversTable.updatedAt)).limit(1);
      if (server?.apiToken) {
        const plainToken = decryptField(server.apiToken);
        const detected = await twentyiFindWorkingKeyFormat(plainToken);
        if (detected.status !== 0) {
          const cleanKey = sanitiseKey(plainToken);
          setCachedKeyFormat(cleanKey, detected.format);
          console.log(`[20i] Key format: "${detected.format}" (HTTP ${detected.status}) — cached for session`);
        } else {
          console.warn(`[20i] All key formats rejected (401) — check key at Admin → Servers`);
        }

      }
    } catch (e: any) {
      console.warn(`[20i] Key format detection failed: ${e.message}`);
    }
  })();

  // Auto-refresh exchange rates on startup and every hour
  const runRefresh = async () => {
    try {
      const result = await refreshExchangeRates();
      if (result.updated > 0) {
        console.log(`[CURRENCIES] Auto-refreshed ${result.updated} exchange rates`);
      }
      if (result.errors.length > 0) {
        console.warn("[CURRENCIES] Rate refresh warnings:", result.errors.join(", "));
      }
    } catch (err: any) {
      console.warn("[CURRENCIES] Rate refresh failed (non-fatal):", err.message);
    }
  };

  runRefresh();
  setInterval(runRefresh, 60 * 60 * 1000);

  // Run cron every 5 minutes
  const runCron = async () => {
    try { await runAllCronTasks(); } catch (err: any) {
      console.warn("[CRON] Task runner error:", err.message);
    }
  };
  runCron();
  setInterval(runCron, 5 * 60 * 1000);

  // 20i connection health check — every 15 minutes, WA alert on failure
  // First check after 3 minutes (let server warm up), then every 15 min.
  setTimeout(() => {
    const healthCheck = async () => {
      try { await runTwentyiHealthCheck(); } catch (err: any) {
        console.warn("[HEALTH] 20i health check error:", err.message);
      }
    };
    healthCheck();
    setInterval(healthCheck, 15 * 60 * 1000);
  }, 3 * 60 * 1000);

  // Seed missing email templates (safe upsert — never overwrites admin edits)
  seedMissingTemplates().then(() => {
    console.log("[TEMPLATES] Default email templates ready");
  }).catch((err: any) => {
    console.warn("[TEMPLATES] Seed failed (non-fatal):", err.message);
  });

  // Seed default VPS plans / OS templates / locations (only if empty)
  seedVpsData().catch((err: any) => {
    console.warn("[VPS] Seed failed (non-fatal):", err.message);
  });

  // Seed default KB articles (only if empty)
  seedKbContent().then(() => {
    console.log("[KB] Knowledge base content ready");
  }).catch((err: any) => {
    console.warn("[KB] Seed failed (non-fatal):", err.message);
  });

  // Initialize WhatsApp gateway (auto-reconnects if session exists)
  initWhatsApp().catch((err: any) => {
    console.warn("[WA] Init failed (non-fatal):", err.message);
  });

  // Auto-detect and fix swapped Safepay keys in DB (non-fatal, self-healing)
  autoFixSafepayKeys().catch(() => {});

  // Bootstrap system API key — log it so admin can see it on first run
  getSystemApiKey().then(key => {
    if (key) {
      console.log(`[SYSTEM-KEY] ✓ System API key active (${key.substring(0, 8)}…) — use X-System-API-Key header`);
    } else {
      console.warn("[SYSTEM-KEY] ⚠ No system API key found in DB — POST /api/admin/sync/rotate-key to generate one");
    }
  }).catch(() => {});
});
