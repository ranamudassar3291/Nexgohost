/**
 * Noehost Domain Registrar Management API
 * Supports: Namecheap, LogicBoxes, ResellerClub, Spaceship, Custom API, None (email-only)
 * + Universal ZIP module installer for any WHMCS-compatible registrar module
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { domainRegistrarsTable, domainsTable, ordersTable, invoicesTable, usersTable, currenciesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import {
  fetchSpaceshipLivePrices,
  fetchSpaceshipBalance,
  runLossPrevention,
  spaceshipRegister,
  spaceshipRenew,
  spaceshipTransfer,
  spaceshipGetEpp,
  spaceshipUpdateNameservers,
  spaceshipGetLock,
  spaceshipSetLock,
  getUsdToPkrWithBuffer,
} from "../lib/spaceship.js";
import OpenAI from "openai";
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
  spaceship: [
    { key: "apiKey",            label: "API Key",                    type: "text",     required: true,  description: "Found in Spaceship Dashboard → API → Keys" },
    { key: "apiSecret",         label: "API Secret",                 type: "password", required: true,  description: "Secret key paired with your API Key" },
    { key: "lossThresholdUsd",  label: "Loss-Prevention Threshold ($)", type: "text", required: false, description: "If live API cost exceeds this USD amount, registration is ABORTED and you get an alert. Default: 1.50" },
    { key: "useAccountBalance", label: "Use Account Balance (Wallet)", type: "checkbox", required: false, description: "Charge all transactions to your $20 Spaceship wallet — instant activation" },
    { key: "sandbox",           label: "Sandbox / Test Mode",        type: "checkbox", required: false, description: "Use Spaceship sandbox environment for testing" },
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

    if (type === "spaceship") {
      const { apiKey, apiSecret } = config;
      const useWallet = config.useAccountBalance !== "false";
      const domainFqdn = params.domainName as string || "";

      if (action === "register") {
        const ns = params.nameservers
          ? (params.nameservers as string).split(",").map((s: string) => s.trim()).filter(Boolean)
          : ["ns1.noehost.com", "ns2.noehost.com"];
        return spaceshipRegister(apiKey, apiSecret, domainFqdn, Number(params.years ?? 1), ns, useWallet);
      }
      if (action === "updateNs") {
        const ns = (params.nameservers as string).split(",").map((s: string) => s.trim()).filter(Boolean);
        return spaceshipUpdateNameservers(apiKey, apiSecret, domainFqdn, ns);
      }
      if (action === "lock") return spaceshipSetLock(apiKey, apiSecret, domainFqdn, true);
      if (action === "unlock") return spaceshipSetLock(apiKey, apiSecret, domainFqdn, false);
      if (action === "getEpp") return spaceshipGetEpp(apiKey, apiSecret, domainFqdn);
      if (action === "check") {
        // Use balance check as connectivity test
        const bal = await fetchSpaceshipBalance(apiKey, apiSecret);
        return { success: true, result: { balance: `$${bal.balance} ${bal.currency}`, message: "Spaceship connection OK" } };
      }
      return { success: false, error: `Spaceship: unknown action '${action}'` };
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

// ── AI Module Generator ───────────────────────────────────────────────────────
// POST /admin/domain-registrars/ai-generate  (SSE streaming)
// POST /admin/domain-registrars/ai-dry-run   (dry-run validation)

function getOpenAI(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) throw new Error("OpenAI AI integration not configured");
  return new OpenAI({ baseURL, apiKey });
}

const PHP_MODULE_SYSTEM_PROMPT = `You are a PHP developer building WHMCS-compatible domain registrar modules.
Generate a complete, production-quality registrar module based on the API documentation provided.
The module must be self-contained and work without any external framework.

REQUIRED OUTPUT FORMAT — return ONLY valid JSON (no markdown, no code fences):
{
  "registrarPhp": "<full PHP file content>",
  "hooksPhp": "<full PHP hooks.php content or empty string>",
  "configFields": [
    { "key": "apiKey", "label": "API Key", "type": "password", "required": true, "description": "..." },
    ...
  ],
  "detectedEndpoints": {
    "register": "POST /domains/register",
    "transfer": "POST /domains/transfer",
    "renew": "POST /domains/renew",
    "getEpp": "GET /domains/{domain}/epp",
    "nameservers": "GET /domains/{domain}/nameservers"
  },
  "apiFormat": "JSON",
  "description": "..."
}

REGISTRAR PHP REQUIREMENTS:
1. File must start with: <?php
2. Module prefix must match the {MODULE_NAME} placeholder
3. Required functions (replace {MODULE_NAME} with the actual slug):
   - {MODULE_NAME}_getConfigArray(): returns array of configurable fields
   - {MODULE_NAME}_RegisterDomain($params): registers a domain
   - {MODULE_NAME}_TransferDomain($params): initiates transfer
   - {MODULE_NAME}_RenewDomain($params): renews domain
   - {MODULE_NAME}_GetNameservers($params): returns ns1-ns4
   - {MODULE_NAME}_SaveNameservers($params): updates nameservers
   - {MODULE_NAME}_GetEPPCode($params): returns EPP/auth code
   - {MODULE_NAME}_GetRegistrarLock($params): returns "locked"/"unlocked"
   - {MODULE_NAME}_SaveRegistrarLock($params): sets lock status
4. Each function must use the config fields via $params['ResellerUsername'], $params['Password'] etc.
5. API calls must use PHP's curl, not file_get_contents
6. Handle JSON/XML/SOAP responses correctly based on what the API uses
7. Return array('error' => 'message') on failure, proper data array on success
8. Include a helper _api_call() function for DRY requests
9. Add PHPDoc comments to each function

HOOKS PHP: Only generate if the API has webhooks, callbacks, or event triggers. Otherwise return empty string.

CONFIG FIELDS: Map all required API credentials (key, secret, endpoint, username, etc.) plus a testMode checkbox.`;

async function generateModuleWithAI(
  docContent: string,
  registrarName: string,
  moduleSlug: string,
): Promise<{
  registrarPhp: string;
  hooksPhp: string;
  configFields: ZipConfigField[];
  detectedEndpoints: Record<string, string>;
  apiFormat: string;
  description: string;
}> {
  const openai = getOpenAI();

  const prompt = PHP_MODULE_SYSTEM_PROMPT.replace(/{MODULE_NAME}/g, moduleSlug);

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: prompt },
      {
        role: "user",
        content: `Generate a registrar module for: ${registrarName}\n\nAPI Documentation:\n${docContent}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  // Strip markdown code fences if the model wrapped output
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  try {
    const parsed = JSON.parse(clean);
    return {
      registrarPhp: parsed.registrarPhp ?? "",
      hooksPhp: parsed.hooksPhp ?? "",
      configFields: Array.isArray(parsed.configFields) ? parsed.configFields : [],
      detectedEndpoints: parsed.detectedEndpoints ?? {},
      apiFormat: parsed.apiFormat ?? "JSON",
      description: parsed.description ?? `${registrarName} registrar module`,
    };
  } catch {
    // Fallback: try to extract just the PHP block if JSON parsing failed
    const phpMatch = raw.match(/<\?php[\s\S]+/);
    return {
      registrarPhp: phpMatch?.[0] ?? `<?php\n// AI generation failed — check documentation format\n`,
      hooksPhp: "",
      configFields: [
        { key: "apiKey",    label: "API Key",    type: "password", required: true  },
        { key: "apiSecret", label: "API Secret", type: "password", required: false },
        { key: "apiUrl",    label: "API URL",    type: "text",     required: false },
        { key: "testMode",  label: "Test Mode",  type: "checkbox", required: false },
      ],
      detectedEndpoints: {},
      apiFormat: "JSON",
      description: `${registrarName} registrar module (partially generated)`,
    };
  }
}

function phpDryRun(phpSrc: string, moduleSlug: string): {
  passed: boolean; warnings: string[]; info: string[];
} {
  const warnings: string[] = [];
  const info: string[] = [];

  // Check required functions exist
  const required = [
    "_getConfigArray", "_RegisterDomain", "_TransferDomain", "_RenewDomain",
    "_GetNameservers", "_SaveNameservers", "_GetEPPCode",
  ];
  for (const fn of required) {
    const fullFn = `${moduleSlug}${fn}`;
    if (!phpSrc.includes(fullFn)) {
      warnings.push(`Missing required function: ${fullFn}()`);
    } else {
      info.push(`✓ ${fullFn}() defined`);
    }
  }

  // Check for dangerous patterns
  const dangerous = [/\beval\s*\(/i, /\bshell_exec\s*\(/i, /\bexec\s*\(\s*\$/i, /\bsystem\s*\(\s*\$/i];
  for (const re of dangerous) {
    if (re.test(phpSrc)) warnings.push(`⚠ Dangerous pattern found: ${re.source.substring(0, 40)}`);
  }

  // Check curl usage
  if (phpSrc.includes("curl_init")) info.push("✓ Uses curl for HTTP (good)");
  if (phpSrc.includes("file_get_contents")) info.push("ℹ Uses file_get_contents (may be blocked on some hosts)");

  // Check config array
  if (phpSrc.includes("_getConfigArray")) {
    info.push("✓ Config array function present");
  }

  // Check PHP opening tag
  if (!phpSrc.trim().startsWith("<?php")) warnings.push("Missing <?php opening tag");
  else info.push("✓ Valid PHP opening tag");

  return { passed: warnings.length === 0, warnings, info };
}

// AI generate route (SSE streaming)
router.post("/admin/domain-registrars/ai-generate",
  authenticate, requireAdmin,
  async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const send = (type: string, data: Record<string, any> = {}) => {
      res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };

    try {
      const { input, inputType, registrarName } = req.body as {
        input: string; inputType: "url" | "text"; registrarName: string;
      };

      if (!input?.trim() || !registrarName?.trim()) {
        send("error", { message: "Registrar name and documentation input are required" });
        res.end(); return;
      }

      const moduleSlug = slugifyName(registrarName);
      const targetDir  = path.join(REGISTRAR_MODULES_DIR, moduleSlug);

      // 1. Fetch documentation if URL
      let docContent = input.trim();
      if (inputType === "url") {
        send("status", { step: "fetch", message: `Fetching API documentation from ${input.substring(0, 60)}…` });
        try {
          const r = await fetch(input, {
            headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html,text/plain,application/json" },
            signal: AbortSignal.timeout(15_000),
          });
          let raw = await r.text();
          // Strip heavy HTML tags
          raw = raw.replace(/<script[\s\S]*?<\/script>/gi, "")
                   .replace(/<style[\s\S]*?<\/style>/gi, "")
                   .replace(/<[^>]+>/g, " ")
                   .replace(/\s{2,}/g, " ")
                   .trim();
          docContent = raw.length > 28_000 ? raw.substring(0, 28_000) + "\n…[truncated]" : raw;
        } catch (err: any) {
          send("error", { message: `Failed to fetch URL: ${err.message}` });
          res.end(); return;
        }
      }

      if (docContent.length < 30) {
        send("error", { message: "Documentation is too short. Provide more detailed API docs." });
        res.end(); return;
      }

      // 2. Generate with AI
      send("status", { step: "generate", message: "AI is analyzing documentation and generating module code…" });
      const generated = await generateModuleWithAI(docContent, registrarName, moduleSlug);
      send("status", { step: "generated", message: "Code generation complete — packaging files…" });

      // 3. Bundle & install
      send("status", { step: "install", message: "Bundling and extracting to modules/registrars/…" });

      if (fs.existsSync(targetDir)) {
        const backupDir = `${targetDir}_backup_${Date.now()}`;
        fs.renameSync(targetDir, backupDir);
        send("status", { step: "backup", message: `Previous version backed up.` });
      }
      fs.mkdirSync(targetDir, { recursive: true });

      // Write PHP files
      const phpPath   = path.join(targetDir, `${moduleSlug}.php`);
      const hooksPath = path.join(targetDir, "hooks.php");
      fs.writeFileSync(phpPath, generated.registrarPhp, "utf8");
      if (generated.hooksPhp?.trim()) {
        fs.writeFileSync(hooksPath, generated.hooksPhp, "utf8");
      }

      // Write module manifest
      fs.writeFileSync(path.join(targetDir, "module.json"), JSON.stringify({
        name: registrarName,
        type: "registrar",
        version: "1.0.0",
        description: generated.description,
        configFields: generated.configFields,
        generatedBy: "ai",
        generatedAt: new Date().toISOString(),
        apiFormat: generated.apiFormat,
        detectedEndpoints: generated.detectedEndpoints,
      }, null, 2), "utf8");

      applyPermissions(targetDir);

      // Also create a downloadable ZIP
      const zip = new AdmZip();
      zip.addLocalFolder(targetDir);
      const zipPath = `${targetDir}.zip`;
      zip.writeZip(zipPath);
      send("status", { step: "packaged", message: "Module ZIP created for download." });

      // 4. Dry run
      send("status", { step: "dryrun", message: "Running dry-run validation…" });
      const dryRun = phpDryRun(generated.registrarPhp, moduleSlug);
      send("status", {
        step: "dryrun_done",
        message: dryRun.passed ? "Dry-run passed — module is safe to activate." : `Dry-run complete — ${dryRun.warnings.length} warning(s).`,
      });

      // 5. Complete
      send("complete", {
        message: `Module "${registrarName}" generated and installed successfully.`,
        moduleSlug,
        folderPath: targetDir,
        folderName: moduleSlug,
        phpFile: phpPath,
        zipPath,
        configFields: generated.configFields,
        detectedEndpoints: generated.detectedEndpoints,
        apiFormat: generated.apiFormat,
        description: generated.description,
        hooksGenerated: !!generated.hooksPhp?.trim(),
        dryRun,
        phpPreview: generated.registrarPhp.substring(0, 2000),
      });
      res.end();
    } catch (err: any) {
      console.error("[AI-MODULE-GEN]", err);
      send("error", { message: err.message || "AI generation failed" });
      res.end();
    }
  }
);

// Dry-run an existing installed module
router.post("/admin/domain-registrars/ai-dry-run/:slug",
  authenticate, requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const slug = req.params.slug.replace(/[^a-z0-9_]/g, "");
      const phpPath = path.join(REGISTRAR_MODULES_DIR, slug, `${slug}.php`);
      if (!fs.existsSync(phpPath)) {
        res.status(404).json({ error: "Module file not found" }); return;
      }
      const src = fs.readFileSync(phpPath, "utf8");
      const result = phpDryRun(src, slug);
      res.json(result);
    } catch (err: any) {
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

// ── Spaceship: Live TLD Prices ────────────────────────────────────────────────
// GET /admin/domain-registrars/:id/live-tld-prices?tlds=.com,.net,.store
router.get("/admin/domain-registrars/:id/live-tld-prices", authenticate, requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const [r] = await db.select().from(domainRegistrarsTable)
        .where(eq(domainRegistrarsTable.id, req.params.id));
      if (!r) { res.status(404).json({ error: "Registrar not found" }); return; }
      if (r.type !== "spaceship") {
        res.status(400).json({ error: "Live prices are only available for Spaceship registrar" });
        return;
      }
      const config = JSON.parse(r.config ?? "{}");
      const tldParam = (req.query.tlds as string) || ".com,.net,.org,.store,.online,.pk,.shop,.info";
      const tlds = tldParam.split(",").map(t => t.trim()).filter(Boolean);

      const [prices, balance, usdToPkr] = await Promise.all([
        fetchSpaceshipLivePrices(config.apiKey, config.apiSecret, tlds),
        fetchSpaceshipBalance(config.apiKey, config.apiSecret).catch(() => ({ balance: null, currency: "USD" })),
        getUsdToPkrWithBuffer(),
      ]);

      res.json({
        success: true,
        usdToPkr,
        buffer: 10,
        balance,
        prices: prices.map(p => ({
          tld: p.tld,
          registrationUsd: p.registrationUsd,
          renewalUsd: p.renewalUsd,
          transferUsd: p.transferUsd,
          registrationPkr: p.registrationUsd != null ? Math.round(p.registrationUsd * usdToPkr) : null,
          renewalPkr: p.renewalUsd != null ? Math.round(p.renewalUsd * usdToPkr) : null,
          transferPkr: p.transferUsd != null ? Math.round(p.transferUsd * usdToPkr) : null,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── Spaceship: Account Balance ────────────────────────────────────────────────
// GET /admin/domain-registrars/:id/balance
router.get("/admin/domain-registrars/:id/balance", authenticate, requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const [r] = await db.select().from(domainRegistrarsTable)
        .where(eq(domainRegistrarsTable.id, req.params.id));
      if (!r) { res.status(404).json({ error: "Registrar not found" }); return; }
      if (r.type !== "spaceship") {
        res.status(400).json({ error: "Balance check is only available for Spaceship registrar" });
        return;
      }
      const config = JSON.parse(r.config ?? "{}");
      const balance = await fetchSpaceshipBalance(config.apiKey, config.apiSecret);
      res.json({ success: true, ...balance });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

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

          // ── Spaceship Loss-Prevention Kill Switch ──────────────────────────
          if (reg.type === "spaceship") {
            const lossThreshold = Number(config.lossThresholdUsd ?? 1.5);
            // Estimate client paid amount from invoice
            let clientPaidPkr = 0;
            if (order.invoiceId) {
              const [inv] = await db.select({ total: invoicesTable.total } as any)
                .from(invoicesTable).where(eq(invoicesTable.id, order.invoiceId)).limit(1);
              clientPaidPkr = Number((inv as any)?.total ?? 0);
            }

            const lossCheck = await runLossPrevention(
              config.apiKey,
              config.apiSecret,
              tld,
              clientPaidPkr,
              lossThreshold,
              fullDomain,
              "registration",
            );

            if (!lossCheck.allowed) {
              res.status(402).json({
                aborted: true,
                lossPreventionTriggered: true,
                reason: lossCheck.reason,
                liveCostUsd: lossCheck.liveCostUsd,
                liveCostPkr: lossCheck.liveCostPkr,
                thresholdUsd: lossCheck.lossThresholdUsd,
                usdToPkr: lossCheck.usdToPkr,
                message: `Registration ABORTED: Live API cost $${lossCheck.liveCostUsd} exceeds your threshold of $${lossCheck.lossThresholdUsd}. WhatsApp + Email alert sent to admin.`,
              });
              return;
            }

            // Use Spaceship wallet — register via native lib
            const useWallet = config.useAccountBalance !== "false";
            apiCallResult = await spaceshipRegister(
              config.apiKey, config.apiSecret, fullDomain,
              Number(period), nsArr, useWallet,
            );
          } else {
            apiCallResult = await callRegistrarApi(reg.type, "register", config, {
              domainName: fullDomain,
              years: String(period),
              nameservers: nsArr.join(","),
              ns1: nsArr[0], ns2: nsArr[1],
            });
          }
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

// ── Spaceship: Direct Domain Operations (free-form, no DB domain required) ─────
// POST /admin/domain-registrars/:id/spaceship-action
router.post("/admin/domain-registrars/:id/spaceship-action", authenticate, requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const [r] = await db.select().from(domainRegistrarsTable)
        .where(eq(domainRegistrarsTable.id, req.params.id));
      if (!r) { res.status(404).json({ error: "Registrar not found" }); return; }
      if (r.type !== "spaceship") {
        res.status(400).json({ error: "This endpoint is for Spaceship registrars only" });
        return;
      }

      const config = JSON.parse(r.config ?? "{}");
      const { apiKey, apiSecret } = config;
      if (!apiKey || !apiSecret) {
        res.status(400).json({ error: "Spaceship API Key and Secret are not configured" });
        return;
      }

      const {
        action,
        domainName,
        period = 1,
        authCode,
        nameservers,
        useWallet,
      } = req.body as {
        action: string;
        domainName?: string;
        period?: number;
        authCode?: string;
        nameservers?: string;
        useWallet?: boolean;
      };

      const useAccountBalance = useWallet ?? (config.useAccountBalance !== "false");

      if (action === "balance") {
        const bal = await fetchSpaceshipBalance(apiKey, apiSecret);
        res.json({ success: true, result: bal });
        return;
      }

      if (!domainName) {
        res.status(400).json({ error: "domainName is required for this action" });
        return;
      }

      const fqdn = domainName.includes(".") ? domainName : `${domainName}.com`;

      if (action === "getInfo") {
        const { spaceshipGetDomainInfo } = await import("../lib/spaceship.js");
        const result = await spaceshipGetDomainInfo(apiKey, apiSecret, fqdn);
        res.json(result);
        return;
      }

      if (action === "register") {
        const nsArr = nameservers
          ? nameservers.split(",").map((s: string) => s.trim()).filter(Boolean)
          : ["ns1.noehost.com", "ns2.noehost.com"];
        const result = await spaceshipRegister(apiKey, apiSecret, fqdn, Number(period), nsArr, useAccountBalance);
        res.json(result);
        return;
      }

      if (action === "renew") {
        const result = await spaceshipRenew(apiKey, apiSecret, fqdn, Number(period), useAccountBalance);
        res.json(result);
        return;
      }

      if (action === "transfer") {
        if (!authCode) { res.status(400).json({ error: "authCode is required for transfer" }); return; }
        const result = await spaceshipTransfer(apiKey, apiSecret, fqdn, authCode, useAccountBalance);
        res.json(result);
        return;
      }

      if (action === "getEpp") {
        const result = await spaceshipGetEpp(apiKey, apiSecret, fqdn);
        res.json(result);
        return;
      }

      if (action === "lock") {
        const result = await spaceshipSetLock(apiKey, apiSecret, fqdn, true);
        res.json(result);
        return;
      }

      if (action === "unlock") {
        const result = await spaceshipSetLock(apiKey, apiSecret, fqdn, false);
        res.json(result);
        return;
      }

      if (action === "getLock") {
        const result = await spaceshipGetLock(apiKey, apiSecret, fqdn);
        res.json(result);
        return;
      }

      if (action === "updateNs") {
        if (!nameservers) { res.status(400).json({ error: "nameservers is required for updateNs" }); return; }
        const nsArr = nameservers.split(",").map((s: string) => s.trim()).filter(Boolean);
        const result = await spaceshipUpdateNameservers(apiKey, apiSecret, fqdn, nsArr);
        res.json(result);
        return;
      }

      if (action === "getNameservers") {
        const { spaceshipGetNameservers } = await import("../lib/spaceship.js");
        const result = await spaceshipGetNameservers(apiKey, apiSecret, fqdn);
        res.json(result);
        return;
      }

      res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (err: any) {
      console.error("[SPACESHIP-ACTION]", err);
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;
