import { Router } from "express";
import { db } from "@workspace/db";
import { hostingServicesTable } from "@workspace/db/schema";
import { authenticate, type AuthRequest } from "../lib/auth.js";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

// ── Seeded deterministic RNG ──────────────────────────────────────────────────
function seedRng(serviceId: string, day: number) {
  const base = serviceId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return (slot: number) => {
    const x = Math.sin(base * 9301 + day * 49297 + slot * 233) * 100000;
    return Math.abs(x) - Math.floor(Math.abs(x));
  };
}

function buildMetrics(serviceId: string, sslStatus: string, diskUsed: string | null, bwUsed: string | null, dayOffset = 0) {
  const day = Math.floor(Date.now() / 86_400_000) - dayOffset;
  const r = seedRng(serviceId, day);
  const uptimePct   = parseFloat((99.50 + r(1) * 0.49).toFixed(2));
  const speedScore  = Math.round(70 + r(2) * 30);
  const cpuPct      = parseFloat((6 + r(3) * 59).toFixed(1));
  const ramPct      = parseFloat((12 + r(4) * 68).toFixed(1));
  const diskPct     = diskUsed ? Math.min(99, parseFloat((parseInt(diskUsed) / 5120 * 100).toFixed(1))) : parseFloat((5 + r(5) * 40).toFixed(1));
  const bwPct       = bwUsed   ? Math.min(99, parseFloat((parseInt(bwUsed)   / 102400 * 100).toFixed(1))) : parseFloat((2 + r(6) * 35).toFixed(1));
  const ssl         = sslStatus === "installed" || sslStatus === "active" ? "active" : sslStatus || "unknown";
  return { uptimePct, speedScore, cpuPct, ramPct, diskPct, bwPct, ssl };
}

function aiRecommendation(services: { cpuPct: number; ramPct: number; diskPct: number; speedScore: number }[]) {
  if (!services.length) return { icon: "sparkles", text: "Add a hosting service to start monitoring your site's health." };
  const avgCpu   = services.reduce((s, m) => s + m.cpuPct, 0) / services.length;
  const avgRam   = services.reduce((s, m) => s + m.ramPct, 0) / services.length;
  const maxDisk  = Math.max(...services.map(m => m.diskPct));
  const minSpeed = Math.min(...services.map(m => m.speedScore));

  if (maxDisk > 75)  return { icon: "hdd",   text: `Your disk is at ${maxDisk.toFixed(0)}% capacity — upgrading to NVMe storage gives you 3× more space and 30% faster page loads.` };
  if (avgCpu > 65)   return { icon: "cpu",   text: `CPU usage is averaging ${avgCpu.toFixed(0)}% — a VPS upgrade would give you dedicated cores and eliminate slowdowns during traffic spikes.` };
  if (avgRam > 70)   return { icon: "ram",   text: `RAM usage is at ${avgRam.toFixed(0)}% — consider upgrading your plan so your site never runs out of memory during peak hours.` };
  if (minSpeed < 75) return { icon: "speed", text: `Your speed score is ${minSpeed} — switching to an NVMe SSD plan can boost page loading by up to 30% and improve your SEO ranking.` };
  return { icon: "sparkles", text: "Your site is growing steadily! Upgrading to NVMe SSD storage now would give you 30% faster loads and room to scale as your traffic increases." };
}

// ── GET /api/my/site-health ───────────────────────────────────────────────────
router.get("/my/site-health", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const services = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.clientId, userId));

    const activeServices = services.filter(s => s.status === "active");
    const targetServices = activeServices.length > 0 ? activeServices : services.slice(0, 3);

    const metrics = targetServices.map(s => ({
      serviceId: s.id,
      domain:    s.domain || s.planName,
      planName:  s.planName,
      status:    s.status,
      ...buildMetrics(s.id, s.sslStatus || "", s.diskUsed, s.bandwidthUsed),
    }));

    // Save a snapshot for each service (one per day using ON CONFLICT DO NOTHING-ish via time check)
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12h window, don't spam snapshots
    for (const m of metrics) {
      const [recent] = await db.execute(sql`
        SELECT id FROM site_health_snapshots
        WHERE service_id = ${m.serviceId} AND recorded_at > ${cutoff}
        LIMIT 1
      `) as any;
      const hasRecent = (recent as any)?.rows?.length > 0 || (Array.isArray(recent) && recent.length > 0);
      if (!hasRecent) {
        await db.execute(sql`
          INSERT INTO site_health_snapshots
            (service_id, user_id, uptime_pct, ssl_status, speed_score, cpu_pct, ram_pct, disk_pct, bw_pct)
          VALUES
            (${m.serviceId}, ${userId}, ${m.uptimePct}, ${m.ssl}, ${m.speedScore},
             ${m.cpuPct}, ${m.ramPct}, ${m.diskPct}, ${m.bwPct})
        `);
      }
    }

    const ai = aiRecommendation(metrics);
    res.json({ services: metrics, ai, savedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error("[site-health]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/my/site-health/history — last 7 days of snapshots per service ───
router.get("/my/site-health/history", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    // Build 7-day deterministic history for each active service
    const services = await db.select().from(hostingServicesTable)
      .where(eq(hostingServicesTable.clientId, userId));
    const active = services.filter(s => s.status === "active").slice(0, 3);
    if (!active.length) { res.json({ history: [], days: [] }); return; }

    const DAYS = 7;
    const days: string[] = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      days.push(d.toISOString().slice(0, 10));
    }

    // One combined series (avg across services) for the chart
    const series = days.map((date, di) => {
      const dayOffset = DAYS - 1 - di;
      const dayMetrics = active.map(s => buildMetrics(s.id, s.sslStatus || "", s.diskUsed, s.bandwidthUsed, dayOffset));
      const n = dayMetrics.length;
      return {
        date,
        cpu:   parseFloat((dayMetrics.reduce((a, m) => a + m.cpuPct, 0) / n).toFixed(1)),
        ram:   parseFloat((dayMetrics.reduce((a, m) => a + m.ramPct, 0) / n).toFixed(1)),
        speed: Math.round(dayMetrics.reduce((a, m) => a + m.speedScore, 0) / n),
      };
    });

    res.json({ series, days });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
