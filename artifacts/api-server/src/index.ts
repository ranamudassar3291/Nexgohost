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

    // guest_cart_items — guest session shopping cart (no auth required)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS guest_cart_items (
        id TEXT PRIMARY KEY,
        guest_session_token TEXT NOT NULL,
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
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_guest_cart_token ON guest_cart_items(guest_session_token)`);
    console.log("[MIGRATIONS] guest_cart_items table ready");

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

    // ── Growth Suite: SEO scans ───────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS seo_scans (
        id              SERIAL PRIMARY KEY,
        user_id         TEXT NOT NULL,
        domain          TEXT NOT NULL,
        title           TEXT,
        meta_description TEXT,
        og_title        TEXT,
        og_description  TEXT,
        og_image        TEXT,
        twitter_card    TEXT,
        twitter_image   TEXT,
        sitemap_ok      BOOLEAN NOT NULL DEFAULT FALSE,
        robots_ok       BOOLEAN NOT NULL DEFAULT FALSE,
        canonical       TEXT,
        h1_count        INTEGER NOT NULL DEFAULT 0,
        https_ok        BOOLEAN NOT NULL DEFAULT FALSE,
        viewport_ok     BOOLEAN NOT NULL DEFAULT FALSE,
        score           INTEGER NOT NULL DEFAULT 0,
        fetch_ok        BOOLEAN NOT NULL DEFAULT TRUE,
        scanned_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, domain)
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_seo_scans_user ON seo_scans(user_id)`);
    console.log("[MIGRATIONS] seo_scans table ready");

    // ── User Preferences (theme, etc.) ───────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id    TEXT PRIMARY KEY,
        theme      TEXT NOT NULL DEFAULT 'light',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("[MIGRATIONS] user_preferences table ready");

    // ip_unblock_logs — full audit trail of every client self-unblock action
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ip_unblock_logs (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        ip_address  TEXT NOT NULL,
        label       TEXT,
        status      TEXT NOT NULL DEFAULT 'success',
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("[MIGRATIONS] ip_unblock_logs table ready");

    // ticket_drafts — auto-saved ticket drafts per user (one active draft at a time)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ticket_drafts (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL UNIQUE,
        subject     TEXT NOT NULL DEFAULT '',
        message     TEXT NOT NULL DEFAULT '',
        department  TEXT NOT NULL DEFAULT 'Technical Support',
        priority    TEXT NOT NULL DEFAULT 'medium',
        updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("[MIGRATIONS] ticket_drafts table ready");

    // feature_flags — global + per-client feature toggles managed via Command Center
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS feature_flags (
        id         SERIAL PRIMARY KEY,
        feature_key TEXT NOT NULL,
        user_id    TEXT,
        enabled    BOOLEAN NOT NULL DEFAULT TRUE,
        updated_by TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_global_idx
        ON feature_flags (feature_key) WHERE user_id IS NULL
    `));
    await db.execute(sql.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_user_idx
        ON feature_flags (feature_key, user_id) WHERE user_id IS NOT NULL
    `));
    console.log("[MIGRATIONS] feature_flags table ready");

    // admin_config — key/value store for dynamic config (health thresholds, upsell banners)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_config (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL DEFAULT '',
        updated_by TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("[MIGRATIONS] admin_config table ready");

    // servers — new columns added after initial deploy
    await db.execute(sql`ALTER TABLE servers ADD COLUMN IF NOT EXISTS connection_status_detail TEXT`);
    console.log("[MIGRATIONS] servers.connection_status_detail ready");

    // activity_stream — real-time log of advanced tool usage by clients
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS activity_stream (
        id         SERIAL PRIMARY KEY,
        user_id    TEXT NOT NULL,
        user_email TEXT NOT NULL DEFAULT '',
        user_name  TEXT NOT NULL DEFAULT '',
        action     TEXT NOT NULL,
        meta       JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("[MIGRATIONS] activity_stream table ready");

    // ── SEO Engine: blog posts ───────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id               SERIAL PRIMARY KEY,
        title            TEXT NOT NULL,
        slug             TEXT NOT NULL UNIQUE,
        content          TEXT NOT NULL DEFAULT '',
        excerpt          TEXT NOT NULL DEFAULT '',
        category         TEXT NOT NULL DEFAULT 'General',
        cover_image      TEXT NOT NULL DEFAULT '',
        author_name      TEXT NOT NULL DEFAULT 'Noehost Team',
        published        BOOLEAN NOT NULL DEFAULT FALSE,
        published_at     TIMESTAMP,
        meta_title       TEXT NOT NULL DEFAULT '',
        meta_description TEXT NOT NULL DEFAULT '',
        focus_keyword    TEXT NOT NULL DEFAULT '',
        read_time_mins   INTEGER NOT NULL DEFAULT 5,
        created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published, published_at DESC)`);
    console.log("[MIGRATIONS] blog_posts table ready");

    // ── SEO Engine: keyword tracking ─────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS keyword_tracking (
        id         SERIAL PRIMARY KEY,
        user_id    TEXT NOT NULL,
        keyword    TEXT NOT NULL,
        domain     TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_kw_tracking_user ON keyword_tracking(user_id)`);
    console.log("[MIGRATIONS] keyword_tracking table ready");

    // ── SEO Engine: keyword position history ──────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS keyword_positions (
        id         SERIAL PRIMARY KEY,
        keyword_id INTEGER NOT NULL REFERENCES keyword_tracking(id) ON DELETE CASCADE,
        position   INTEGER NOT NULL,
        url        TEXT NOT NULL DEFAULT '',
        checked_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_kw_positions_keyword ON keyword_positions(keyword_id, checked_at DESC)`);
    console.log("[MIGRATIONS] keyword_positions table ready");

    // ── Sales Funnel: flash_sales ─────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS flash_sales (
        id             TEXT PRIMARY KEY,
        title          TEXT NOT NULL,
        slug           TEXT NOT NULL UNIQUE,
        headline       TEXT NOT NULL DEFAULT '',
        subheadline    TEXT NOT NULL DEFAULT '',
        badge_text     TEXT NOT NULL DEFAULT 'Flash Sale',
        cta_text       TEXT NOT NULL DEFAULT 'Grab the Deal',
        cta_url        TEXT NOT NULL DEFAULT '',
        original_price NUMERIC(10,2),
        sale_price     NUMERIC(10,2),
        currency       TEXT NOT NULL DEFAULT 'USD',
        ends_at        TIMESTAMP,
        bg_color       TEXT NOT NULL DEFAULT '#0F172A',
        accent_color   TEXT NOT NULL DEFAULT '#6366F1',
        is_active      BOOLEAN NOT NULL DEFAULT true,
        created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_flash_sales_slug ON flash_sales(slug)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_flash_sales_active ON flash_sales(is_active, ends_at)`);
    console.log("[MIGRATIONS] flash_sales table ready");

    // ── Sales Funnel: cart_recovery_logs ─────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cart_recovery_logs (
        id             TEXT PRIMARY KEY,
        user_id        TEXT,
        email          TEXT,
        plan_name      TEXT,
        plan_id        TEXT,
        cart_value     NUMERIC(10,2),
        discount_code  TEXT,
        status         TEXT NOT NULL DEFAULT 'triggered',
        converted_at   TIMESTAMP,
        created_at     TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_cart_recovery_status ON cart_recovery_logs(status, created_at DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_cart_recovery_user   ON cart_recovery_logs(user_id)`);
    console.log("[MIGRATIONS] cart_recovery_logs table ready");

    // ── Resource Monitor: resource_usage_logs ────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS resource_usage_logs (
        id               SERIAL PRIMARY KEY,
        service_id       TEXT NOT NULL,
        disk_io_read     NUMERIC(12,2),
        disk_io_write    NUMERIC(12,2),
        entry_processes  INTEGER,
        inodes_used      BIGINT,
        inodes_limit     BIGINT,
        cpu_pct          NUMERIC(5,2),
        recorded_at      TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_resource_logs_service ON resource_usage_logs(service_id, recorded_at DESC)`);
    console.log("[MIGRATIONS] resource_usage_logs table ready");

    // ── Resource Monitor: security_scan_logs ─────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS security_scan_logs (
        id          SERIAL PRIMARY KEY,
        service_id  TEXT NOT NULL,
        scan_type   TEXT NOT NULL DEFAULT 'permissions',
        result      TEXT NOT NULL DEFAULT 'success',
        dirs_fixed  INTEGER NOT NULL DEFAULT 0,
        files_fixed INTEGER NOT NULL DEFAULT 0,
        source      TEXT NOT NULL DEFAULT 'none',
        scanned_at  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_security_scans_service ON security_scan_logs(service_id, scanned_at DESC)`);
    console.log("[MIGRATIONS] security_scan_logs table ready");

    // ── Resource Monitor: hosting_cache_settings ──────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS hosting_cache_settings (
        service_id   TEXT PRIMARY KEY,
        edge_cache   BOOLEAN NOT NULL DEFAULT false,
        object_cache BOOLEAN NOT NULL DEFAULT false,
        updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("[MIGRATIONS] hosting_cache_settings table ready");

    // ── Staging & Cloning: staging_sites ─────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging_sites (
        id                SERIAL PRIMARY KEY,
        service_id        TEXT NOT NULL UNIQUE,
        staging_subdomain TEXT,
        staging_url       TEXT,
        status            TEXT NOT NULL DEFAULT 'creating',
        provider          TEXT NOT NULL DEFAULT 'none',
        remote_id         TEXT,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_staging_sites_service ON staging_sites(service_id)`);
    console.log("[MIGRATIONS] staging_sites table ready");

    // ── Staging & Cloning: staging_sync_logs ─────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging_sync_logs (
        id          SERIAL PRIMARY KEY,
        service_id  TEXT NOT NULL,
        action      TEXT NOT NULL DEFAULT 'create',
        status      TEXT NOT NULL DEFAULT 'success',
        steps_json  JSONB NOT NULL DEFAULT '[]',
        note        TEXT,
        logged_at   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_staging_sync_service ON staging_sync_logs(service_id, logged_at DESC)`);
    console.log("[MIGRATIONS] staging_sync_logs table ready");

    // ── AI Support Specialist: ai_conversations ───────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id            SERIAL PRIMARY KEY,
        user_id       TEXT NOT NULL,
        service_id    TEXT,
        role          TEXT NOT NULL DEFAULT 'user',
        content       TEXT NOT NULL,
        metadata_json JSONB NOT NULL DEFAULT '{}',
        created_at    TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ai_convo_user    ON ai_conversations(user_id, created_at DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ai_convo_service ON ai_conversations(service_id, created_at DESC)`);
    console.log("[MIGRATIONS] ai_conversations table ready");

    // ── WhatsApp Client Sync: whatsapp_client_notifications ──────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS whatsapp_client_notifications (
        id          SERIAL PRIMARY KEY,
        user_id     TEXT NOT NULL,
        phone       TEXT NOT NULL,
        event_type  TEXT NOT NULL DEFAULT 'client_notification',
        message     TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'pending',
        error       TEXT,
        sent_at     TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_wa_client_notif_user ON whatsapp_client_notifications(user_id, sent_at DESC)`);
    console.log("[MIGRATIONS] whatsapp_client_notifications table ready");

    // ── Abuse & Spam Handling System ─────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS abuse_reports (
        id                    TEXT PRIMARY KEY,
        report_number         TEXT NOT NULL UNIQUE,
        reporter_email        TEXT NOT NULL,
        reporter_name         TEXT,
        reporter_org          TEXT,
        abuse_type            TEXT NOT NULL DEFAULT 'spam',
        target_domain         TEXT,
        target_ip             TEXT,
        evidence_logs         TEXT NOT NULL,
        service_id            TEXT,
        client_id             TEXT,
        status                TEXT NOT NULL DEFAULT 'pending',
        is_valid              BOOLEAN,
        analysis_notes        TEXT,
        warning_email_sent_at TIMESTAMP,
        warning_deadline      TIMESTAMP,
        suspended_at          TIMESTAMP,
        resolved_at           TIMESTAMP,
        resolved_by           TEXT,
        resolved_note         TEXT,
        dismissed_at          TIMESTAMP,
        dismissed_by          TEXT,
        dismiss_reason        TEXT,
        ticket_id             TEXT,
        auto_suspended        BOOLEAN DEFAULT FALSE,
        notified_client_at    TIMESTAMP,
        created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_abuse_reports_status ON abuse_reports(status, created_at DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_abuse_reports_client ON abuse_reports(client_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_abuse_reports_service ON abuse_reports(service_id)`);
    console.log("[MIGRATIONS] abuse_reports table ready");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS abuse_actions (
        id                TEXT PRIMARY KEY,
        report_id         TEXT NOT NULL REFERENCES abuse_reports(id) ON DELETE CASCADE,
        action_type       TEXT NOT NULL,
        action_note       TEXT,
        performed_by      TEXT NOT NULL,
        performed_by_email TEXT,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_abuse_actions_report ON abuse_actions(report_id, created_at DESC)`);
    console.log("[MIGRATIONS] abuse_actions table ready");

    // ── Sentinel Upgrade: new columns + tables ────────────────────────────────
    await db.execute(sql`ALTER TABLE abuse_reports ADD COLUMN IF NOT EXISTS threat_score INTEGER DEFAULT 0`);
    await db.execute(sql`ALTER TABLE abuse_reports ADD COLUMN IF NOT EXISTS classification TEXT DEFAULT 'low'`);
    await db.execute(sql`ALTER TABLE abuse_reports ADD COLUMN IF NOT EXISTS source_credibility TEXT`);
    await db.execute(sql`ALTER TABLE abuse_reports ADD COLUMN IF NOT EXISTS is_dmca BOOLEAN DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE abuse_reports ADD COLUMN IF NOT EXISTS dmca_deadline_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE abuse_reports ADD COLUMN IF NOT EXISTS counter_notice_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE abuse_reports ADD COLUMN IF NOT EXISTS counter_notice_text TEXT`);
    console.log("[MIGRATIONS] abuse_reports sentinel columns ready");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS abuse_reputation (
        id                    TEXT PRIMARY KEY,
        client_id             TEXT NOT NULL UNIQUE,
        client_email          TEXT,
        total_reports         INTEGER DEFAULT 0,
        valid_reports         INTEGER DEFAULT 0,
        threat_score_sum      INTEGER DEFAULT 0,
        avg_threat_score      INTEGER DEFAULT 0,
        max_threat_score      INTEGER DEFAULT 0,
        last_report_at        TIMESTAMP,
        is_permanently_banned BOOLEAN DEFAULT FALSE,
        ban_reason            TEXT,
        banned_at             TIMESTAMP,
        banned_by             TEXT,
        created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_abuse_rep_client ON abuse_reputation(client_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_abuse_rep_score ON abuse_reputation(avg_threat_score DESC)`);
    console.log("[MIGRATIONS] abuse_reputation table ready");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS abuse_evidence (
        id          TEXT PRIMARY KEY,
        report_id   TEXT NOT NULL REFERENCES abuse_reports(id) ON DELETE CASCADE,
        file_name   TEXT,
        file_url    TEXT,
        mime_type   TEXT,
        description TEXT,
        uploaded_by TEXT,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_abuse_evidence_report ON abuse_evidence(report_id)`);
    console.log("[MIGRATIONS] abuse_evidence table ready");

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
