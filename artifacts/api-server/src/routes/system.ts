/**
 * GET /api/system/ip
 * Detects the real outgoing IP of this server by querying two external services.
 * Primary:   https://api.ipify.org?format=json
 * Secondary: https://ifconfig.me/ip
 */
import { Router } from "express";
import { authenticate, requireAdmin } from "../lib/auth.js";

const router = Router();

async function fetchIp(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    const text = (await res.text()).trim();
    if (!res.ok || !text) return null;
    // ipify returns JSON { ip: "x.x.x.x" }, ifconfig.me returns plain text
    if (text.startsWith("{")) {
      const parsed = JSON.parse(text);
      return parsed.ip ?? null;
    }
    // Basic IPv4 / IPv6 sanity check
    return /^[\d.:a-fA-F]+$/.test(text) ? text : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/system/ip
 * Returns the real outgoing IPs of this server (primary + secondary).
 * Both are fetched in parallel to save latency.
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
