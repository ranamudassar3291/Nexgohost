import { Router } from "express";
import { db } from "@workspace/db";
import { domainsTable, hostingServicesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../lib/auth.js";

const router = Router();

/**
 * GET /api/client/setup-progress
 * Returns the 3-step "go live" progress for the authenticated user.
 *
 * Step 1 — Domain registered: user has at least one active domain
 * Step 2 — Hosting active:    user has at least one active hosting service
 * Step 3 — Site live:         both step 1 and step 2 are complete
 *           (Real SSL verification is outside scope; we infer "live" from hosting being active)
 */
router.get("/api/client/setup-progress", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const [domains, services] = await Promise.all([
      db
        .select({ id: domainsTable.id, name: domainsTable.name, tld: domainsTable.tld, status: domainsTable.status })
        .from(domainsTable)
        .where(and(eq(domainsTable.userId, userId), eq(domainsTable.status, "active"))),
      db
        .select({ id: hostingServicesTable.id, domain: hostingServicesTable.domain, status: hostingServicesTable.status })
        .from(hostingServicesTable)
        .where(and(eq(hostingServicesTable.userId, userId), eq(hostingServicesTable.status, "active"))),
    ]);

    const step1 = domains.length > 0;
    const step2 = services.length > 0;
    const step3 = step1 && step2;

    const primaryDomain = domains[0] ? `${domains[0].name}${domains[0].tld}` : null;
    const primaryService = services[0] ?? null;
    const siteUrl = primaryService?.domain
      ? `https://${primaryService.domain}`
      : primaryDomain
        ? `https://${primaryDomain}`
        : null;

    const stepsComplete = [step1, step2, step3].filter(Boolean).length;
    const pct = Math.round((stepsComplete / 3) * 100);

    res.json({
      step1,
      step2,
      step3,
      allComplete: step3,
      primaryDomain,
      siteUrl,
      pct,
      domainCount: domains.length,
      serviceCount: services.length,
    });
  } catch (err: any) {
    console.error("[setup-progress]", err);
    res.status(500).json({ error: "Failed to fetch setup progress" });
  }
});

export default router;
