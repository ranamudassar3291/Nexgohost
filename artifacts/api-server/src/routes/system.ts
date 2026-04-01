/**
 * GET /api/system/ip
 * Detects the real outgoing IP of this server using axios.
 * Primary:   https://api.ipify.org?format=json
 * Secondary: https://ifconfig.me/ip
 */
import { Router } from "express";
import axios from "axios";
import { authenticate, requireAdmin } from "../lib/auth.js";

const router = Router();

async function fetchIp(url: string): Promise<string | null> {
  try {
    const res = await axios.get(url, { timeout: 8000 });
    if (typeof res.data === "object" && res.data?.ip) return String(res.data.ip);
    const text = String(res.data ?? "").trim();
    return /^[\d.:a-fA-F]+$/.test(text) ? text : null;
  } catch {
    return null;
  }
}

/**
 * GET /debug-ip  (public — no auth)
 * Returns the real outgoing IP of this backend server.
 * Open in browser: yourdomain.com/api/debug-ip
 */
router.get("/debug-ip", async (_req, res) => {
  console.log("[DEBUG-IP] Detecting real outbound IP…");
  const ip = await fetchIp("https://api.ipify.org?format=json");
  const ip2 = await fetchIp("https://ifconfig.me/ip");
  console.log(`[DEBUG-IP] Result: ${ip ?? "failed"} / ${ip2 ?? "failed"}`);
  res.json({
    serverIp: ip ?? ip2 ?? "could not detect",
    primary: ip ?? null,
    secondary: ip2 ?? null,
    instruction: "Add BOTH IPs to: my.20i.com → Reseller API → IP Whitelist",
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/system/ip  (admin only)
 * Returns the real outgoing IPs of this server (primary + secondary).
 */
router.get("/system/ip", authenticate, requireAdmin, async (_req, res) => {
  console.log("[SYSTEM-IP] Detecting real outbound IP…");

  const [primary, secondary] = await Promise.all([
    fetchIp("https://api.ipify.org?format=json"),
    fetchIp("https://ifconfig.me/ip"),
  ]);

  console.log(`[SYSTEM-IP] Primary   (ipify.org):    ${primary ?? "failed"}`);
  console.log(`[SYSTEM-IP] Secondary (ifconfig.me):  ${secondary ?? "failed"}`);

  if (!primary && !secondary) {
    res.status(502).json({
      success: false,
      error: "Could not detect outbound IP — both services timed out.",
      primary: null,
      secondary: null,
    });
    return;
  }

  res.json({
    success: true,
    primary: primary ?? null,
    secondary: secondary ?? null,
    sources: {
      primary: "api.ipify.org",
      secondary: "ifconfig.me",
    },
  });
});

export default router;
