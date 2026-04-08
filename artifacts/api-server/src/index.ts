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
import { and, eq, desc } from "drizzle-orm";

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
