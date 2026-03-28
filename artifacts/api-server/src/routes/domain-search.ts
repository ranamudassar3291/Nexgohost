/**
 * Live Domain Availability Checker
 * Uses RDAP (free, no API key) with DNS fallback.
 * RDAP is the modern successor to WHOIS — query registries directly.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { domainExtensionsTable, settingsTable } from "@workspace/db/schema";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

// ── RDAP Bootstrap: TLD → RDAP server URL ────────────────────────────────────
// (subset for common TLDs; falls back to rdap.org gateway for unlisted ones)
const RDAP_OVERRIDES: Record<string, string> = {
  "com":  "https://rdap.verisign.com/com/v1/",
  "net":  "https://rdap.verisign.com/net/v1/",
  "org":  "https://rdap.publicinterestregistry.org/rdap/",
  "io":   "https://rdap.nic.io/",
  "co":   "https://rdap.nic.co/",
  "pk":   "https://rdap.pknic.net.pk/",
  "uk":   "https://rdap.nominet.uk/uk/",
  "de":   "https://rdap.denic.de/",
  "com.pk": "https://rdap.pknic.net.pk/",
  "net.pk": "https://rdap.pknic.net.pk/",
};

// Free RDAP gateway (fallback)
const RDAP_GATEWAY = "https://rdap.org/domain/";

interface TldRow {
  extension: string;
  registerPrice: string;
  renewPrice: string;
  isActive: boolean;
}

interface SearchResult {
  domain: string;
  available: boolean | null;
  status: "available" | "taken" | "unknown";
  registerPrice: number | null;
  renewPrice: number | null;
  extension: string;
  checkedVia: string;
}

async function checkRdap(domain: string): Promise<{ available: boolean; via: string } | null> {
  const tld = domain.slice(domain.indexOf(".") + 1).toLowerCase();
  const url = RDAP_OVERRIDES[tld]
    ? `${RDAP_OVERRIDES[tld]}domain/${domain}`
    : `${RDAP_GATEWAY}${domain}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/rdap+json, application/json" },
      signal: AbortSignal.timeout(7000),
    });

    if (res.status === 404) return { available: true, via: "rdap" };
    if (res.status === 200) {
      const data = await res.json();
      // If a full registration record comes back, domain is taken
      if (data.ldhName || data.handle || data.events?.length > 0) return { available: false, via: "rdap" };
      const statuses: string[] = data.status ?? [];
      const isRegistered = statuses.some((s: string) =>
        ["active", "registered", "client transfer prohibited", "server transfer prohibited"].includes(s.toLowerCase())
      );
      return { available: !isRegistered, via: "rdap" };
    }
    if (res.status === 400 || res.status === 422) return null; // bad request
    return null;
  } catch {
    return null;
  }
}

async function checkCloudflare(domain: string): Promise<{ available: boolean; via: string } | null> {
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // NXDOMAIN (3) = likely available; resolved A records (0 + answers) = taken
    if (data.Status === 3) return { available: true, via: "cloudflare-dns" };
    if (data.Status === 0 && data.Answer?.length > 0) return { available: false, via: "cloudflare-dns" };
    return null;
  } catch {
    return null;
  }
}

async function checkGoogleDns(domain: string): Promise<{ available: boolean; via: string } | null> {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.Status === 3) return { available: true, via: "google-dns" };
    if (data.Status === 0 && data.Answer?.length > 0) return { available: false, via: "google-dns" };
    // Also check SOA record as secondary signal
    const soaRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=SOA`, {
      signal: AbortSignal.timeout(3000),
    });
    if (soaRes.ok) {
      const soaData = await soaRes.json();
      if (soaData.Status === 3) return { available: true, via: "google-dns-soa" };
      if (soaData.Status === 0 && soaData.Answer?.length > 0) return { available: false, via: "google-dns-soa" };
    }
    return null;
  } catch {
    return null;
  }
}

// POST /api/domain-search
router.post("/domain-search", authenticate, async (req: AuthRequest, res) => {
  try {
    const { domain: rawDomain, tlds } = req.body as { domain?: string; tlds?: string[] };
    if (!rawDomain || typeof rawDomain !== "string") {
      res.status(400).json({ error: "domain is required" }); return;
    }

    const baseName = rawDomain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").split(".")[0] ?? rawDomain;
    if (!baseName || baseName.length < 2) {
      res.status(400).json({ error: "Invalid domain name" }); return;
    }

    // Which TLDs to check: passed in body, or fetch active ones from DB
    let targetExtensions: string[] = [];
    if (Array.isArray(tlds) && tlds.length > 0) {
      targetExtensions = tlds.map(t => t.toLowerCase().replace(/^\./, ""));
    } else {
      const rows = await db.select().from(domainExtensionsTable)
        .then(r => r.filter(e => e.status === "active").slice(0, 8));
      targetExtensions = rows.map(r => r.extension.replace(/^\./, ""));
    }

    // Fetch all prices in one query
    const priceRows = await db.select().from(domainExtensionsTable)
      .then(r => r.filter(e => targetExtensions.includes(e.extension.replace(/^\./, ""))));

    const priceMap = new Map<string, TldRow>();
    for (const row of priceRows) {
      priceMap.set(row.extension.replace(/^\./, ""), row as TldRow);
    }

    // Check all TLDs in parallel
    const results = await Promise.all(
      targetExtensions.map(async (ext): Promise<SearchResult> => {
        const fullDomain = `${baseName}.${ext}`;
        const priceRow = priceMap.get(ext);

        // Try RDAP first, then Cloudflare DNS, then Google DNS
        let check = await checkRdap(fullDomain);
        if (!check) check = await checkCloudflare(fullDomain);
        if (!check) check = await checkGoogleDns(fullDomain);

        const available = check?.available ?? null;
        const fullRow = priceMap.get(ext) as any;
        return {
          domain: fullDomain,
          available,
          status: available === true ? "available" : available === false ? "taken" : "unknown",
          registerPrice:      priceRow ? parseFloat(priceRow.registerPrice) : null,
          register2YearPrice: fullRow?.register2YearPrice ? parseFloat(fullRow.register2YearPrice) : null,
          register3YearPrice: fullRow?.register3YearPrice ? parseFloat(fullRow.register3YearPrice) : null,
          renewPrice:         priceRow ? parseFloat(priceRow.renewPrice ?? priceRow.renewalPrice ?? "0") : null,
          isFreeWithHosting:  fullRow?.isFreeWithHosting ?? false,
          extension: `.${ext}`,
          checkedVia: check?.via ?? "unknown",
        };
      })
    );

    // Sort: available first, then taken, then unknown
    results.sort((a, b) => {
      const order = { available: 0, unknown: 1, taken: 2 };
      return (order[a.status] ?? 1) - (order[b.status] ?? 1);
    });

    res.json({ baseName, results });
  } catch (err) {
    console.error("[DOMAIN-SEARCH]", err);
    res.status(500).json({ error: "Search failed" });
  }
});

// GET /api/domain-search/tlds — list available TLDs for the search UI
router.get("/domain-search/tlds", authenticate, async (_req, res) => {
  try {
    const rows = await db.select().from(domainExtensionsTable)
      .then(r => r.filter(e => e.status === "active"));
    res.json(rows.sort((a,b) => (a.sortOrder??999)-(b.sortOrder??999)).map(r => ({
      extension: r.extension,
      tld: r.extension.startsWith(".") ? r.extension : `.${r.extension}`,
      registerPrice: parseFloat(r.registerPrice as any),
      register2YearPrice: r.register2YearPrice ? parseFloat(r.register2YearPrice as any) : null,
      register3YearPrice: r.register3YearPrice ? parseFloat(r.register3YearPrice as any) : null,
      renewPrice: parseFloat(r.renewalPrice as any),
      renewalPrice: parseFloat(r.renewalPrice as any),
      isFreeWithHosting: r.isFreeWithHosting ?? false,
      sortOrder: r.sortOrder ?? 999,
      showInSuggestions: r.showInSuggestions ?? true,
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch TLDs" });
  }
});

// GET /api/domain-search/promo — public promo banner config
router.get("/domain-search/promo", async (_req, res) => {
  try {
    const PROMO_KEYS = ["domain_promo_enabled", "domain_promo_tld", "domain_promo_price",
                        "domain_promo_original_price", "domain_promo_text", "domain_promo_years"];
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string> = {};
    for (const r of rows) { if (PROMO_KEYS.includes(r.key)) map[r.key] = r.value ?? ""; }

    res.json({
      enabled: map["domain_promo_enabled"] !== "false",
      tld: map["domain_promo_tld"] || ".com",
      price: parseFloat(map["domain_promo_price"] || "99"),
      originalPrice: parseFloat(map["domain_promo_original_price"] || "3000"),
      text: map["domain_promo_text"] || "Special deal — Get a .com domain for Rs. 99/1st year when you buy for 3 years",
      years: parseInt(map["domain_promo_years"] || "3"),
    });
  } catch (err) {
    console.error("[PROMO-FETCH]", err);
    res.status(500).json({ error: "Failed to fetch promo" });
  }
});

// PUT /api/admin/domain-search/promo — update promo banner config (admin only)
router.put("/admin/domain-search/promo", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { enabled, tld, price, originalPrice, text, years } = req.body;
    const updates: Array<{ key: string; value: string }> = [
      { key: "domain_promo_enabled",        value: String(enabled ?? true) },
      { key: "domain_promo_tld",            value: tld ?? ".com" },
      { key: "domain_promo_price",          value: String(price ?? 99) },
      { key: "domain_promo_original_price", value: String(originalPrice ?? 3000) },
      { key: "domain_promo_text",           value: text ?? "" },
      { key: "domain_promo_years",          value: String(years ?? 3) },
    ];
    for (const u of updates) {
      await db.insert(settingsTable).values({ key: u.key, value: u.value })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value: u.value } });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[PROMO-UPDATE]", err);
    res.status(500).json({ error: "Failed to update promo" });
  }
});

export default router;
