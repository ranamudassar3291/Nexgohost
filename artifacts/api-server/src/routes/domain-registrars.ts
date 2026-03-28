/**
 * Noehost Domain Registrar Management API
 * Supports: Namecheap, LogicBoxes, ResellerClub, Custom API, None (email-only)
 * + Universal ZIP module installer for any WHMCS-compatible registrar module
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { domainRegistrarsTable, domainsTable, ordersTable, invoicesTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import multer from "multer";
import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REGISTRAR_MODULES_DIR = path.resolve(__dirname, "../../modules/registrars");
fs.mkdirSync(REGISTRAR_MODULES_DIR, { recursive: true });

const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter(_req, file, cb) {
    if (file.mimetype === "application/zip" || file.mimetype === "application/x-zip-compressed" || file.originalname.endsWith(".zip")) {
      cb(null, true);
    } else {
      cb(new Error("Only .zip files are allowed"));
    }
  },
});

// ── PHP registrar module detection ────────────────────────────────────────────

interface ZipConfigField {
  key: string; label: string; type: string;
  required?: boolean; description?: string; options?: string[];
}

function slugifyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/**
 * Parse WHMCS-style PHP _getConfigArray() return value.
 * Handles: 'Type' => 'text'|'password'|'yesno'|'textarea'|'dropdown'
 */
function parsePhpConfigArray(phpSrc: string): ZipConfigField[] {
  const fields: ZipConfigField[] = [];
  // Match top-level array entries: 'key' => array(...) or 'key' => [...]
  const entryRe = /['"]([A-Za-z_][A-Za-z0-9_]*)['"] *=> *(?:array\s*\(|\[)([\s\S]*?)(?:\)|])\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(phpSrc)) !== null) {
    const key = m[1];
    const body = m[2];
    // Skip meta-only fields
    if (key === "FriendlyName" || key === "APIVersion") continue;

    const friendlyMatch = body.match(/['"]FriendlyName['"]\s*=>\s*['"]([^'"]+)['"]/i);
    const typeMatch     = body.match(/['"]Type['"]\s*=>\s*['"]([^'"]+)['"]/i);
    const descMatch     = body.match(/['"]Description['"]\s*=>\s*['"]([^'"]+)['"]/i);
    const reqMatch      = body.match(/['"]Required['"]\s*=>\s*(true|false)/i);

    const rawType = (typeMatch?.[1] ?? "text").toLowerCase();
    const mappedType =
      rawType === "password" ? "password" :
      rawType === "yesno"    ? "checkbox"  :
      rawType === "textarea" ? "textarea"  :
      rawType === "dropdown" ? "text"      : "text";

    fields.push({
      key,
      label: friendlyMatch?.[1] ?? key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim(),
      type: mappedType,
      description: descMatch?.[1],
      required: reqMatch?.[1] === "true",
    });
  }
  return fields;
}

/**
 * Detect registrar name and config fields from a ZIP.
 * Priority: module.json → PHP _getConfigArray → filename heuristics
 */
function detectRegistrarFromZip(zipBuffer: Buffer): {
  name: string; description: string; configFields: ZipConfigField[];
  hooks: string[]; phpModuleName: string | null; detected: boolean;
} {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  // 1. module.json
  const manifestEntry = entries.find(e =>
    e.entryName === "module.json" || /^[^/]+\/module\.json$/.test(e.entryName)
  );
  if (manifestEntry) {
    try {
      const m = JSON.parse(manifestEntry.getData().toString("utf8"));
      if (m.name) return {
        name: m.name, description: m.description ?? "",
        configFields: m.configFields ?? [],
        hooks: m.hooks ?? [], phpModuleName: null, detected: true,
      };
    } catch { /* fall through */ }
  }

  // 2. PHP files with getConfigArray
  const phpFiles = entries.filter(e => !e.isDirectory && e.entryName.endsWith(".php"));
  for (const entry of phpFiles) {
    const src = entry.getData().toString("utf8");
    if (!/_getConfigArray\s*\(/i.test(src)) continue;

    // Extract PHP module function prefix (e.g. "spaceship" from spaceship_getConfigArray)
    const fnMatch = src.match(/function\s+([A-Za-z_][A-Za-z0-9_]*)_getConfigArray\s*\(/i);
    const phpModuleName = fnMatch?.[1] ?? null;

    // Extract module FriendlyName
    const friendlyMatch = src.match(/['"]FriendlyName['"]\s*=>\s*\[\s*['"]Type['"]\s*=>\s*['"]System['"]\s*,\s*['"]Value['"]\s*=>\s*['"]([^'"]+)['"]/i) ||
                          src.match(/['"]FriendlyName['"]\s*=>\s*['"]([^'"]+)['"]/i);

    // Find config block
    const configMatch = src.match(/_getConfigArray\s*\(\s*\)[^{]*{([\s\S]*?)return\s*(\[[\s\S]*?\]|array\s*\([\s\S]*?\))\s*;/i);
    const configBlock = configMatch?.[2] ?? "";
    const fields = parsePhpConfigArray(configBlock);

    // Extract hooks
    const hookMatches = [...src.matchAll(/add_hook\s*\(\s*['"]([^'"]+)['"]/g)];
    const hooks = hookMatches.map(h => h[1]);

    return {
      name: friendlyMatch?.[1] ?? phpModuleName ?? path.basename(entry.entryName, ".php"),
      description: `Uploaded PHP registrar module${phpModuleName ? ` (${phpModuleName})` : ""}`,
      configFields: fields.length > 0 ? fields : [
        { key: "apiKey", label: "API Key", type: "password", required: true },
        { key: "apiSecret", label: "API Secret", type: "password", required: false },
        { key: "testMode", label: "Test Mode", type: "checkbox", required: false },
      ],
      hooks, phpModuleName, detected: true,
    };
  }

  // 3. Fallback: name from ZIP filename pattern + default fields
  const zipName = phpFiles[0]?.entryName ? path.basename(phpFiles[0].entryName, ".php") : "custom-registrar";
  return {
    name: zipName, description: "Auto-detected registrar module — configure manually.",
    configFields: [
      { key: "apiKey",    label: "API Key",    type: "password", required: true  },
      { key: "username",  label: "Username",   type: "text",     required: false },
      { key: "apiUrl",    label: "API Base URL",type: "text",    required: false },
      { key: "testMode",  label: "Test Mode",  type: "checkbox", required: false },
    ],
    hooks: [], phpModuleName: null, detected: false,
  };
}

// ── Security scanner ───────────────────────────────────────────────────────────

const DANGEROUS_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\beval\s*\(\s*base64_decode/i,           label: "Obfuscated eval(base64_decode(...))" },
  { re: /\bshell_exec\s*\(/i,                      label: "shell_exec() — command execution" },
  { re: /\bexec\s*\(\s*\$/i,                       label: "exec() with variable input" },
  { re: /\bsystem\s*\(\s*\$/i,                     label: "system() with variable input" },
  { re: /\bpassthru\s*\(/i,                        label: "passthru() — raw command output" },
  { re: /\bproc_open\s*\(/i,                       label: "proc_open() — process spawning" },
  { re: /\$_(?:GET|POST|REQUEST|COOKIE)\s*\[['"]cmd['"]\]/i, label: "Remote command injection via $_GET/POST['cmd']" },
  { re: /`[^`]*\$[^`]*`/,                          label: "Backtick command execution with variable" },
  { re: /file_put_contents\s*\(\s*['"]\s*(?:\/etc|\/usr\/bin|\/bin)\//i, label: "Writing to system directories" },
  { re: /\bfsockopen\s*\(\s*['"][^'"]+['"],\s*(?:4444|1337|31337)\b/i, label: "Suspicious reverse shell socket" },
];

function scanForMalware(zipBuffer: Buffer): { safe: boolean; warnings: string[] } {
  const zip = new AdmZip(zipBuffer);
  const warnings: string[] = [];
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const ext = path.extname(entry.entryName).toLowerCase();
    if (![".php", ".js", ".ts", ".sh", ".py"].includes(ext)) continue;
    const src = entry.getData().toString("utf8");
    for (const { re, label } of DANGEROUS_PATTERNS) {
      if (re.test(src)) {
        warnings.push(`${path.basename(entry.entryName)}: ${label}`);
        break;
      }
    }
  }
  return { safe: warnings.length === 0, warnings };
}

// ── Extract ZIP with permissions ───────────────────────────────────────────────

function extractZipToDir(zipBuffer: Buffer, targetDir: string): void {
  const zip = new AdmZip(zipBuffer);
  zip.extractAllTo(targetDir, true);
  applyPermissions(targetDir);
}

function applyPermissions(dirPath: string): void {
  try {
    fs.chmodSync(dirPath, 0o755);
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        applyPermissions(full);
      } else {
        fs.chmodSync(full, 0o644);
      }
    }
  } catch { /* non-fatal */ }
}

// ── hooks.php extractor ────────────────────────────────────────────────────────

function extractHooksFromZip(zipBuffer: Buffer): string[] {
  const zip = new AdmZip(zipBuffer);
  const hooks: string[] = [];
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const n = entry.entryName.toLowerCase();
    if (!n.endsWith("hooks.php") && !n.endsWith("hooks.js")) continue;
    const src = entry.getData().toString("utf8");
    for (const m of src.matchAll(/add_hook\s*\(\s*['"]([^'"]+)['"]/g)) hooks.push(m[1]);
    for (const m of src.matchAll(/exports\.([A-Za-z][A-Za-z0-9_]+)\s*=/g)) hooks.push(m[1]);
  }
  return [...new Set(hooks)];
}

const router = Router();

// ── Config field definitions per registrar type ───────────────────────────────
export const REGISTRAR_FIELDS: Record<string, { key: string; label: string; type: string; required?: boolean; description?: string }[]> = {
  namecheap: [
    { key: "apiUser",   label: "API Username",   type: "text",     required: true,  description: "Your Namecheap username" },
    { key: "apiKey",    label: "API Key",         type: "password", required: true,  description: "Namecheap API key from profile" },
    { key: "username",  label: "Reseller Username", type: "text",  required: true  },
    { key: "clientIp",  label: "Whitelisted IP",  type: "text",     required: true,  description: "IP that is whitelisted in Namecheap account" },
    { key: "sandbox",   label: "Sandbox Mode",    type: "checkbox", required: false, description: "Use Namecheap test sandbox" },
  ],
  logicboxes: [
    { key: "authId",    label: "Auth-ID (Reseller ID)", type: "text",     required: true },
    { key: "apiKey",    label: "API Key",               type: "password", required: true },
    { key: "testMode",  label: "Test Mode",             type: "checkbox", required: false, description: "Use LogicBoxes test environment" },
  ],
  resellerclub: [
    { key: "authId",    label: "Auth-ID",  type: "text",     required: true },
    { key: "apiKey",    label: "API Key",  type: "password", required: true },
    { key: "testMode",  label: "Test Mode", type: "checkbox", required: false },
  ],
  enom: [
    { key: "username",  label: "eNom Username", type: "text",     required: true },
    { key: "password",  label: "eNom Password", type: "password", required: true },
    { key: "sandbox",   label: "Sandbox Mode",  type: "checkbox", required: false },
  ],
  opensrs: [
    { key: "username",  label: "Reseller Username", type: "text",     required: true },
    { key: "apiKey",    label: "API Key",            type: "password", required: true },
    { key: "sandbox",   label: "Sandbox Mode",       type: "checkbox", required: false },
  ],
  custom: [
    { key: "apiUrl",    label: "API Base URL",      type: "text",     required: true,  description: "Base URL of your custom registrar API" },
    { key: "apiKey",    label: "API Key",            type: "password", required: true  },
    { key: "authHeader",label: "Auth Header Name",  type: "text",     required: false, description: "e.g. X-API-Key, Authorization" },
    { key: "username",  label: "Username",           type: "text",     required: false },
    { key: "password",  label: "Password",           type: "password", required: false },
    { key: "extraJson", label: "Extra Config (JSON)",type: "textarea", required: false, description: "Additional key-value pairs as JSON" },
  ],
  none: [],
};

// ── Registrar API stubs ───────────────────────────────────────────────────────
// In production these would call the actual registrar APIs.
// For now: Namecheap & LogicBoxes have real API structures; Custom makes a webhook call.

async function callRegistrarApi(
  type: string,
  action: "register" | "updateNs" | "lock" | "unlock" | "getEpp" | "check",
  config: Record<string, string>,
  params: Record<string, any>,
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    if (type === "none") {
      return { success: true, result: { message: "Email notification queued — manual processing required." } };
    }

    if (type === "namecheap") {
      const base = config.sandbox === "true"
        ? "https://api.sandbox.namecheap.com/xml.response"
        : "https://api.namecheap.com/xml.response";

      const cmdMap: Record<string, string> = {
        register:  "namecheap.domains.create",
        updateNs:  "namecheap.domains.dns.setCustom",
        lock:      "namecheap.domains.setRegistrarLock",
        unlock:    "namecheap.domains.setRegistrarLock",
        getEpp:    "namecheap.domains.getInfo",
        check:     "namecheap.domains.check",
      };

      const qp = new URLSearchParams({
        ApiUser:   config.apiUser,
        ApiKey:    config.apiKey,
        UserName:  config.username,
        ClientIp:  config.clientIp,
        Command:   cmdMap[action],
        ...params,
      });

      const res = await fetch(`${base}?${qp.toString()}`, { method: "GET" });
      const text = await res.text();
      const ok = text.includes('Status="OK"');
      return { success: ok, result: text, error: ok ? undefined : "API returned non-OK status" };
    }

    if (type === "logicboxes" || type === "resellerclub") {
      const base = config.testMode === "true"
        ? "https://test.httpapi.com/api"
        : "https://httpapi.com/api";

      const endpoints: Record<string, string> = {
        register: "/domains/register.json",
        updateNs: "/domains/modify-ns.json",
        lock:     "/domains/modify.json",
        unlock:   "/domains/modify.json",
        getEpp:   "/domains/details-by-name.json",
        check:    "/domains/available.json",
      };

      const url = `${base}${endpoints[action]}?auth-userid=${config.authId}&api-key=${config.apiKey}&${new URLSearchParams(params).toString()}`;
      const res = await fetch(url);
      const data = await res.json();
      return { success: res.ok, result: data, error: res.ok ? undefined : data.message || "API error" };
    }

    if (type === "custom") {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const authHeader = config.authHeader || "Authorization";
      headers[authHeader] = config.apiKey;
      const res = await fetch(`${config.apiUrl}/${action}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ username: config.username, password: config.password, ...params }),
      });
      const data = await res.json().catch(() => ({}));
      return { success: res.ok, result: data, error: res.ok ? undefined : data.error || "Custom API error" };
    }

    return { success: false, error: `Unsupported registrar type: ${type}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// ── Upload registrar ZIP module ───────────────────────────────────────────────
// POST /admin/domain-registrars/upload-module
//   ?action=overwrite|backup  — required when a conflict was already reported
router.post("/admin/domain-registrars/upload-module",
  authenticate, requireAdmin,
  zipUpload.single("module"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No .zip file provided" });
        return;
      }

      // 1. Security scan — run before extraction
      const { safe, warnings } = scanForMalware(req.file.buffer);
      if (!safe) {
        res.status(422).json({
          error: "Security scan failed",
          securityWarnings: warnings,
          message: "The uploaded ZIP contains potentially dangerous code patterns. Upload blocked.",
        });
        return;
      }

      // 2. Detect module type
      const detected = detectRegistrarFromZip(req.file.buffer);
      const folderName = slugifyName(detected.name || detected.phpModuleName || "custom_registrar");
      const targetDir = path.join(REGISTRAR_MODULES_DIR, folderName);

      // 3. Conflict detection
      const conflictAction = (req.query.action as string | undefined) ?? "";
      if (fs.existsSync(targetDir) && !conflictAction) {
        res.status(409).json({
          conflict: true,
          conflictName: folderName,
          manifest: {
            name: detected.name,
            description: detected.description,
            configFields: detected.configFields,
            hooks: detected.hooks,
          },
          detectedAuto: detected.detected,
          securityWarnings: warnings,
          message: `A module folder "${folderName}" already exists. Choose an action to continue.`,
        });
        return;
      }

      // 4. Handle conflict resolution
      if (fs.existsSync(targetDir)) {
        if (conflictAction === "backup") {
          const backupDir = `${targetDir}_backup_${Date.now()}`;
          fs.renameSync(targetDir, backupDir);
        } else {
          // overwrite — remove existing
          fs.rmSync(targetDir, { recursive: true, force: true });
        }
      }

      // 5. Extract ZIP to modules/registrars/<folderName>/
      extractZipToDir(req.file.buffer, targetDir);

      // 6. Hook extraction
      const autoHooks = extractHooksFromZip(req.file.buffer);
      const allHooks = [...new Set([...detected.hooks, ...autoHooks])];

      // 7. Build response — return detected fields so frontend can auto-populate a registrar config form
      const responseFields = detected.configFields.length > 0
        ? detected.configFields
        : [
            { key: "apiKey",   label: "API Key",   type: "password", required: true  },
            { key: "username", label: "Username",  type: "text",     required: false },
            { key: "testMode", label: "Test Mode", type: "checkbox", required: false },
          ];

      let message = detected.detected
        ? `Module "${detected.name}" installed successfully.`
        : `Module installed — config auto-detected. Verify fields before saving.`;
      if (allHooks.length > 0) message += ` ${allHooks.length} hook(s) registered: ${allHooks.slice(0, 3).join(", ")}${allHooks.length > 3 ? "…" : ""}.`;
      if (conflictAction === "backup") message += " Previous version backed up.";
      if (conflictAction === "overwrite") message += " Previous version overwritten.";

      res.json({
        name: detected.name,
        description: detected.description,
        phpModuleName: detected.phpModuleName,
        folderPath: targetDir,
        folderName,
        configFields: responseFields,
        hooks: allHooks,
        detected: detected.detected,
        securityWarnings: warnings,
        message,
      });
    } catch (err: any) {
      console.error("[REGISTRAR-UPLOAD]", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// List all registrars
router.get("/admin/domain-registrars", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const list = await db.select().from(domainRegistrarsTable).orderBy(domainRegistrarsTable.createdAt);
    res.json(list.map(r => ({
      ...r,
      config: JSON.parse(r.config ?? "{}"),
      fields: REGISTRAR_FIELDS[r.type] ?? [],
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get field definitions for a registrar type
router.get("/admin/domain-registrars/fields/:type", authenticate, requireAdmin, (req: Request, res: Response) => {
  const fields = REGISTRAR_FIELDS[req.params.type] ?? [];
  res.json({ fields });
});

// Create registrar
router.post("/admin/domain-registrars", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, type, description, config, isDefault } = req.body as {
      name: string; type: string; description?: string;
      config: Record<string, string>; isDefault?: boolean;
    };

    if (!name || !type) { res.status(400).json({ error: "Name and type are required" }); return; }

    // If setting as default, clear other defaults
    if (isDefault) {
      await db.update(domainRegistrarsTable).set({ isDefault: false });
    }

    const [r] = await db.insert(domainRegistrarsTable).values({
      name,
      type: type as any,
      description: description ?? "",
      config: JSON.stringify(config ?? {}),
      isActive: true,
      isDefault: isDefault ?? false,
    }).returning();

    res.json({ ...r, config: JSON.parse(r.config), fields: REGISTRAR_FIELDS[r.type] ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update registrar config
router.put("/admin/domain-registrars/:id", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, config, isActive, isDefault } = req.body;

    if (isDefault) {
      await db.update(domainRegistrarsTable).set({ isDefault: false });
    }

    const [r] = await db.update(domainRegistrarsTable)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(config !== undefined && { config: JSON.stringify(config) }),
        ...(isActive !== undefined && { isActive }),
        ...(isDefault !== undefined && { isDefault }),
        updatedAt: new Date(),
      })
      .where(eq(domainRegistrarsTable.id, req.params.id))
      .returning();

    if (!r) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...r, config: JSON.parse(r.config), fields: REGISTRAR_FIELDS[r.type] ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle active
router.post("/admin/domain-registrars/:id/toggle", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const [cur] = await db.select().from(domainRegistrarsTable).where(eq(domainRegistrarsTable.id, req.params.id));
    if (!cur) { res.status(404).json({ error: "Not found" }); return; }
    const [r] = await db.update(domainRegistrarsTable)
      .set({ isActive: !cur.isActive, updatedAt: new Date() })
      .where(eq(domainRegistrarsTable.id, req.params.id))
      .returning();
    res.json({ isActive: r.isActive });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test connection
router.post("/admin/domain-registrars/:id/test", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const [r] = await db.select().from(domainRegistrarsTable).where(eq(domainRegistrarsTable.id, req.params.id));
    if (!r) { res.status(404).json({ error: "Not found" }); return; }

    const config = JSON.parse(r.config ?? "{}");

    let testResult: { success: boolean; result?: any; error?: string };
    if (r.type === "none") {
      testResult = { success: true, result: { message: "Email-only mode — no API connection required." } };
    } else {
      testResult = await callRegistrarApi(r.type, "check", config, { "domain-name": "noehost.com" });
    }

    const resultText = testResult.success
      ? "Connection successful"
      : `Failed: ${testResult.error ?? "Unknown error"}`;

    await db.update(domainRegistrarsTable)
      .set({ lastTestedAt: new Date(), lastTestResult: resultText, updatedAt: new Date() })
      .where(eq(domainRegistrarsTable.id, req.params.id));

    res.json({ success: testResult.success, message: resultText, detail: testResult.result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete registrar
router.delete("/admin/domain-registrars/:id", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    await db.delete(domainRegistrarsTable).where(eq(domainRegistrarsTable.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Domain action via registrar ───────────────────────────────────────────────
// POST /admin/domain-registrars/:registrarId/action/:domainId
router.post("/admin/domain-registrars/:registrarId/action/:domainId",
  authenticate, requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { action } = req.body as { action: "updateNs" | "lock" | "unlock" | "getEpp" };
      const [registrar] = await db.select().from(domainRegistrarsTable)
        .where(eq(domainRegistrarsTable.id, req.params.registrarId));
      if (!registrar) { res.status(404).json({ error: "Registrar not found" }); return; }

      const [domain] = await db.select().from(domainsTable)
        .where(eq(domainsTable.id, req.params.domainId));
      if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }

      const config = JSON.parse(registrar.config ?? "{}");
      const params: Record<string, any> = {
        domainName: domain.name + domain.tld,
        nameservers: (domain.nameservers ?? ["ns1.noehost.com", "ns2.noehost.com"]).join(","),
      };

      const result = await callRegistrarApi(registrar.type, action, config, params);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── Activate domain order with registrar ─────────────────────────────────────
// This augments the existing activate-domain flow with registrar API call
router.post("/admin/orders/:id/activate-domain-registrar", authenticate, requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { registrarId, period = 1 } = req.body as { registrarId?: string; period?: number };

      const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, req.params.id)).limit(1);
      if (!order) { res.status(404).json({ error: "Order not found" }); return; }
      if (order.type !== "domain") { res.status(400).json({ error: "Not a domain order" }); return; }

      const fullDomain = order.domain || order.itemName || "";
      const dotIdx = fullDomain.indexOf(".");
      const domainName = dotIdx > 0 ? fullDomain.substring(0, dotIdx) : fullDomain;
      const tld = dotIdx > 0 ? fullDomain.substring(dotIdx) : ".com";

      // Get registrar details (optional — may be "none" or omitted)
      let registrarName = "manual";
      let apiCallResult: any = null;

      if (registrarId && registrarId !== "none") {
        const [reg] = await db.select().from(domainRegistrarsTable)
          .where(eq(domainRegistrarsTable.id, registrarId));
        if (reg) {
          registrarName = reg.name;
          const config = JSON.parse(reg.config ?? "{}");
          const nsArr = ["ns1.noehost.com", "ns2.noehost.com"];
          apiCallResult = await callRegistrarApi(reg.type, "register", config, {
            domainName: fullDomain,
            years: String(period),
            nameservers: nsArr.join(","),
            ns1: nsArr[0], ns2: nsArr[1],
          });
        }
      }

      // Create / update domain record
      const existing = await db.select().from(domainsTable)
        .where(eq(domainsTable.clientId, order.clientId));
      const found = existing.find(d => d.name === domainName && d.tld === tld);

      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + (period || 1));

      let domain;
      if (found) {
        [domain] = await db.update(domainsTable)
          .set({
            status: "active",
            registrar: registrarName,
            expiryDate,
            nextDueDate: expiryDate,
            nameservers: ["ns1.noehost.com", "ns2.noehost.com"],
            updatedAt: new Date(),
          })
          .where(eq(domainsTable.id, found.id))
          .returning();
      } else {
        [domain] = await db.insert(domainsTable).values({
          clientId: order.clientId,
          name: domainName,
          tld,
          status: "active",
          registrar: registrarName,
          registrationDate: new Date(),
          expiryDate,
          nextDueDate: expiryDate,
          nameservers: ["ns1.noehost.com", "ns2.noehost.com"],
          lockStatus: "locked",
        }).returning();
      }

      // Mark order active
      await db.update(ordersTable)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(ordersTable.id, req.params.id));

      // Mark invoice paid if exists
      if (order.invoiceId) {
        await db.update(invoicesTable)
          .set({ status: "paid", paidAt: new Date() } as any)
          .where(eq(invoicesTable.id, order.invoiceId));
      }

      res.json({
        domain: { id: domain.id, name: domain.name, tld: domain.tld, status: domain.status },
        registrar: registrarName,
        apiCallResult,
        message: apiCallResult?.success === false
          ? `Domain record created but registrar API call failed: ${apiCallResult.error}. Please register manually.`
          : `Domain ${fullDomain} activated successfully via ${registrarName}.`,
      });
    } catch (err: any) {
      console.error("[DOMAIN-REGISTRAR] activate error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;
