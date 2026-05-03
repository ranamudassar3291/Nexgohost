import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, hostingServicesTable, domainsTable } from "@workspace/db/schema";
import { authenticate, type AuthRequest } from "../lib/auth.js";
import { eq, and, sql, count } from "drizzle-orm";

const router = Router();

// ── GET /api/my/preferences ──────────────────────────────────────────────────
router.get("/my/preferences", authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  try {
    // Fetch theme preference
    const prefRow = await db.execute(sql`
      SELECT theme FROM user_preferences WHERE user_id = ${userId}
    `);
    const theme = (prefRow.rows[0] as any)?.theme ?? "light";

    // Fetch user for member since
    const [user] = await db.select({
      createdAt: usersTable.createdAt,
      firstName: usersTable.firstName,
    }).from(usersTable).where(eq(usersTable.id, userId));

    // Count active services
    const [hostingResult] = await db.select({ cnt: count() })
      .from(hostingServicesTable)
      .where(and(
        eq(hostingServicesTable.clientId, userId),
        eq(hostingServicesTable.status, "active")
      ));
    const [domainResult] = await db.select({ cnt: count() })
      .from(domainsTable)
      .where(and(
        eq(domainsTable.clientId, userId),
        eq(domainsTable.status, "active")
      ));

    const serviceCount  = Number(hostingResult?.cnt ?? 0);
    const domainCount   = Number(domainResult?.cnt ?? 0);
    const totalServices = serviceCount + domainCount;

    // VIP level
    let vipLevel: string;
    let vipNext: string | null;
    let vipNextAt: number;
    if (totalServices >= 6)       { vipLevel = "Elite";  vipNext = null;     vipNextAt = 6; }
    else if (totalServices >= 3)  { vipLevel = "Pro";    vipNext = "Elite";  vipNextAt = 6; }
    else if (totalServices >= 1)  { vipLevel = "Growth"; vipNext = "Pro";    vipNextAt = 3; }
    else                          { vipLevel = "Starter";vipNext = "Growth"; vipNextAt = 1; }

    const vipProgress = vipNext ? Math.min(100, Math.round((totalServices / vipNextAt) * 100)) : 100;

    res.json({
      theme,
      memberSince: user?.createdAt ?? new Date(),
      serviceCount,
      domainCount,
      totalServices,
      vipLevel,
      vipNext,
      vipNextAt,
      vipProgress,
    });
  } catch (err: any) {
    console.error("[preferences] GET:", err.message);
    res.status(500).json({ error: "Failed to load preferences" });
  }
});

// ── PUT /api/my/preferences ──────────────────────────────────────────────────
router.put("/my/preferences", authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const { theme } = req.body as { theme?: string };

  if (theme && !["light", "dark"].includes(theme)) {
    return res.status(400).json({ error: "Invalid theme value" });
  }

  try {
    await db.execute(sql`
      INSERT INTO user_preferences (user_id, theme, updated_at)
      VALUES (${userId}, ${theme ?? "light"}, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        theme      = EXCLUDED.theme,
        updated_at = NOW()
    `);
    res.json({ ok: true, theme });
  } catch (err: any) {
    console.error("[preferences] PUT:", err.message);
    res.status(500).json({ error: "Failed to save preferences" });
  }
});

export default router;
