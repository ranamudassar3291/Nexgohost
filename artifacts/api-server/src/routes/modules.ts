/**
 * Noehost Dynamic Module & Gateway Installer
 * POST /admin/modules/upload  — upload .zip, extract, detect, register
 * GET  /admin/modules          — list all uploaded modules
 * PUT  /admin/modules/:id/config — save config
 * POST /admin/modules/:id/activate — toggle active
 * DELETE /admin/modules/:id   — remove module
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { uploadedModulesTable } from "@workspace/db/schema";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { authenticate, requireAdmin } from "../lib/auth.js";
import multer from "multer";
import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = path.resolve(__dirname, "../../modules");

// Ensure module dirs exist
fs.mkdirSync(path.join(MODULES_DIR, "servers"),    { recursive: true });
fs.mkdirSync(path.join(MODULES_DIR, "gateways"),   { recursive: true });
fs.mkdirSync(path.join(MODULES_DIR, "registrars"), { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter(_req, file, cb) {
    if (file.mimetype === "application/zip" || file.originalname.endsWith(".zip")) {
      cb(null, true);
    } else {
      cb(new Error("Only .zip files are allowed"));
    }
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "select" | "checkbox" | "textarea";
  required?: boolean;
  options?: string[];
  placeholder?: string;
  description?: string;
}

interface ModuleManifest {
  name: string;
  type: "server" | "gateway" | "registrar";
  version?: string;
  description?: string;
  configFields?: ConfigField[];
  hooks?: string[];
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function detectModuleFromZip(zipBuffer: Buffer): {
  manifest: ModuleManifest;
  folderPath: string;
  detected: boolean;
} {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  // 1. Look for module.json at root or one level deep
  let manifestEntry = entries.find(e =>
    e.entryName === "module.json" ||
    e.entryName.match(/^[^/]+\/module\.json$/)
  );

  if (manifestEntry) {
    try {
      const manifest: ModuleManifest = JSON.parse(manifestEntry.getData().toString("utf8"));
      if (manifest.name && manifest.type) {
        return { manifest, folderPath: "", detected: true };
      }
    } catch { /* fall through */ }
  }

  // 2. Look for any .json with configFields
  for (const entry of entries) {
    if (!entry.entryName.endsWith(".json") || entry.isDirectory) continue;
    try {
      const data = JSON.parse(entry.getData().toString("utf8"));
      if (data.configFields && Array.isArray(data.configFields)) {
        return {
          manifest: {
            name: data.name || "Unknown Module",
            type: data.type ?? "gateway",
            version: data.version ?? "1.0.0",
            description: data.description ?? "",
            configFields: data.configFields,
            hooks: data.hooks ?? [],
          },
          folderPath: "",
          detected: true,
        };
      }
    } catch { continue; }
  }

  // 3. Auto-detect from file structure — scan for JS/TS/PHP entry files
  const codeFiles = entries.filter(e => !e.isDirectory && (e.entryName.endsWith(".js") || e.entryName.endsWith(".ts") || e.entryName.endsWith(".php")));
  const isGateway   = codeFiles.some(e => /pay|gateway|checkout|merchant/i.test(e.entryName));
  const isRegistrar = codeFiles.some(e => /registrar|domain|whois|epp|register/i.test(e.entryName));
  const isServer    = codeFiles.some(e => /server|hosting|cpanel|provision/i.test(e.entryName));

  return {
    manifest: {
      name: "Custom Module",
      type: isRegistrar ? "registrar" : isServer ? "server" : "gateway",
      version: "1.0.0",
      description: "Auto-detected module — no module.json found. Configure manually.",
      configFields: [
        { key: "api_url",    label: "API URL",     type: "text",     required: true  },
        { key: "api_key",    label: "API Key",     type: "password", required: true  },
        { key: "secret_key", label: "Secret Key",  type: "password", required: false },
      ],
      hooks: [],
    },
    folderPath: "",
    detected: false,
  };
}

function extractZipToDir(zipBuffer: Buffer, targetDir: string): void {
  const zip = new AdmZip(zipBuffer);
  zip.extractAllTo(targetDir, true);
  // Apply 755 permissions recursively so module files are immediately executable
  setPermissionsRecursive(targetDir);
}

function setPermissionsRecursive(dirPath: string): void {
  try {
    fs.chmodSync(dirPath, 0o755);
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      fs.chmodSync(fullPath, 0o755);
      if (entry.isDirectory()) {
        setPermissionsRecursive(fullPath);
      }
    }
  } catch {
    // Non-fatal — permissions may already be correct or filesystem may not support chmod
  }
}

// ── SQL Runner ────────────────────────────────────────────────────────────────

async function runInstallSql(zipBuffer: Buffer): Promise<{ ran: boolean; statements: number; error?: string }> {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const sqlEntry = entries.find(e =>
    e.entryName === "install.sql" ||
    e.entryName.match(/^[^/]+\/install\.sql$/)
  );
  if (!sqlEntry) return { ran: false, statements: 0 };
  const raw = sqlEntry.getData().toString("utf8");
  // Split on semicolons, filter blank lines
  const statements = raw
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith("--"));
  let ran = 0;
  try {
    for (const stmt of statements) {
      await db.execute(drizzleSql.raw(stmt));
      ran++;
    }
    return { ran: true, statements: ran };
  } catch (err: any) {
    return { ran: ran > 0, statements: ran, error: err.message };
  }
}

// ── Hook Extractor ────────────────────────────────────────────────────────────

function extractHooksFromZip(zipBuffer: Buffer): string[] {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const hooks: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.toLowerCase();
    if (!name.endsWith("hooks.php") && !name.endsWith("hooks.js") && !name.endsWith("hooks.ts")) continue;

    const src = entry.getData().toString("utf8");
    // PHP: add_hook('hookName', ...) or function onHookName(
    const phpMatches = [...src.matchAll(/add_hook\s*\(\s*['"]([^'"]+)['"]/g)];
    for (const m of phpMatches) hooks.push(m[1]);
    // PHP/JS: function onXxx( or onXxx: function
    const fnMatches = [...src.matchAll(/(?:function\s+|['"])(on[A-Z][A-Za-z]+)(?:\s*\(|['"])/g)];
    for (const m of fnMatches) hooks.push(m[1]);
    // JS: module.exports = { hookName: ... } or exports.hookName
    const exportMatches = [...src.matchAll(/exports\.([A-Za-z][A-Za-z0-9_]+)\s*=/g)];
    for (const m of exportMatches) if (!hooks.includes(m[1])) hooks.push(m[1]);
  }
  // Deduplicate
  return [...new Set(hooks)];
}

// ── Routes ────────────────────────────────────────────────────────────────────
const router = Router();

// List all uploaded modules
router.get("/admin/modules/uploaded", authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const modules = await db.select().from(uploadedModulesTable).orderBy(uploadedModulesTable.uploadedAt);
    res.json(modules.map(m => ({
      ...m,
      configFields: JSON.parse(m.configFields),
      config: JSON.parse(m.config),
      hooks: JSON.parse(m.hooks),
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upload & auto-detect module
router.post("/admin/modules/upload",
  authenticate, requireAdmin,
  upload.single("module"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No .zip file provided" });
        return;
      }

      // Detect module from zip
      const { manifest, detected } = detectModuleFromZip(req.file.buffer);
      const slug = slugify(manifest.name) + "-" + Date.now().toString(36);
      const typeDir = manifest.type === "server" ? "servers" : manifest.type === "registrar" ? "registrars" : "gateways";
      const targetDir = path.join(MODULES_DIR, typeDir, slug);

      // Extract to modules folder
      extractZipToDir(req.file.buffer, targetDir);

      // ── SQL Runner: auto-execute install.sql if present
      const sqlResult = await runInstallSql(req.file.buffer);

      // ── Hook Extraction: merge manifest hooks + auto-detected hooks from hooks files
      const autoHooks = extractHooksFromZip(req.file.buffer);
      const allHooks = [...new Set([...(manifest.hooks ?? []), ...autoHooks])];

      // Check for slug uniqueness
      const existing = await db.select().from(uploadedModulesTable)
        .where(eq(uploadedModulesTable.slug, slug));
      if (existing.length > 0) {
        fs.rmSync(targetDir, { recursive: true, force: true });
        res.status(409).json({ error: "Module with this name already exists" });
        return;
      }

      const [inserted] = await db.insert(uploadedModulesTable).values({
        name: manifest.name,
        slug,
        type: manifest.type,
        version: manifest.version ?? "1.0.0",
        description: manifest.description ?? "",
        configFields: JSON.stringify(manifest.configFields ?? []),
        config: "{}",
        hooks: JSON.stringify(allHooks),
        folderPath: targetDir,
        status: "inactive",
        isActive: false,
      }).returning();

      let message = detected
        ? `Module "${manifest.name}" detected and registered successfully.`
        : `Module installed with auto-detected config fields. Please verify and fill in the configuration.`;
      if (sqlResult.ran) {
        message += ` Database schema applied (${sqlResult.statements} statement${sqlResult.statements === 1 ? "" : "s"}).`;
      }
      if (allHooks.length > 0) {
        message += ` ${allHooks.length} hook${allHooks.length === 1 ? "" : "s"} registered.`;
      }

      res.json({
        module: {
          ...inserted,
          configFields: JSON.parse(inserted.configFields),
          config: JSON.parse(inserted.config),
          hooks: JSON.parse(inserted.hooks),
        },
        detected,
        sqlResult,
        hooksRegistered: allHooks,
        message,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Update module metadata (name, description, configFields)
router.put("/admin/modules/:id/meta", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, configFields } = req.body as {
      name?: string;
      description?: string;
      configFields?: ConfigField[];
    };
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (configFields !== undefined) updates.configFields = JSON.stringify(configFields);

    const [updated] = await db.update(uploadedModulesTable)
      .set(updates)
      .where(eq(uploadedModulesTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Module not found" }); return; }
    res.json({
      ...updated,
      configFields: JSON.parse(updated.configFields),
      config: JSON.parse(updated.config),
      hooks: JSON.parse(updated.hooks),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save config & optionally activate
router.put("/admin/modules/:id/config", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { config, activate } = req.body as { config: Record<string, string>; activate?: boolean };
    const [updated] = await db.update(uploadedModulesTable)
      .set({
        config: JSON.stringify(config),
        isActive: activate ?? false,
        status: (activate ? "active" : "inactive") as any,
        updatedAt: new Date(),
      })
      .where(eq(uploadedModulesTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Module not found" }); return; }
    res.json({
      ...updated,
      configFields: JSON.parse(updated.configFields),
      config: JSON.parse(updated.config),
      hooks: JSON.parse(updated.hooks),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle active status
router.post("/admin/modules/:id/activate", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const mod = await db.select().from(uploadedModulesTable)
      .where(eq(uploadedModulesTable.id, req.params.id));
    if (!mod.length) { res.status(404).json({ error: "Module not found" }); return; }

    const newActive = !mod[0].isActive;
    const [updated] = await db.update(uploadedModulesTable)
      .set({
        isActive: newActive,
        status: (newActive ? "active" : "inactive") as any,
        updatedAt: new Date(),
      })
      .where(eq(uploadedModulesTable.id, req.params.id))
      .returning();
    res.json({ isActive: updated.isActive, status: updated.status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── File Browser: list files already on server in module directories ──────────
router.get("/admin/modules/files", authenticate, requireAdmin, (req: Request, res: Response) => {
  try {
    const category = (req.query.category as string) || "";
    const allowedCategories = ["registrars", "gateways", "servers", ""];
    const baseDir = category && allowedCategories.includes(category)
      ? path.join(MODULES_DIR, category)
      : MODULES_DIR;

    if (!fs.existsSync(baseDir)) {
      res.json({ files: [], baseDir });
      return;
    }

    function walkDir(dir: string, relRoot: string): Array<{ name: string; path: string; size: number; isDir: boolean }> {
      const result: Array<{ name: string; path: string; size: number; isDir: boolean }> = [];
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const rel = path.join(relRoot, entry.name);
          if (entry.isDirectory()) {
            result.push({ name: entry.name, path: rel, size: 0, isDir: true });
            result.push(...walkDir(path.join(dir, entry.name), rel));
          } else {
            const stat = fs.statSync(path.join(dir, entry.name));
            result.push({ name: entry.name, path: rel, size: stat.size, isDir: false });
          }
        }
      } catch { /* skip unreadable dirs */ }
      return result;
    }

    const files = walkDir(baseDir, "");
    res.json({ files, baseDir });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete module
router.delete("/admin/modules/:id", authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const [mod] = await db.select().from(uploadedModulesTable)
      .where(eq(uploadedModulesTable.id, req.params.id));
    if (!mod) { res.status(404).json({ error: "Module not found" }); return; }

    // Remove extracted folder if it exists
    if (mod.folderPath && fs.existsSync(mod.folderPath)) {
      fs.rmSync(mod.folderPath, { recursive: true, force: true });
    }

    await db.delete(uploadedModulesTable).where(eq(uploadedModulesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
