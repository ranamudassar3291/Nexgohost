import { Router } from "express";
import { db } from "@workspace/db";
import { domainExtensionsTable } from "@workspace/db/schema";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/admin/domain-extensions
router.get("/admin/domain-extensions", authenticate, requireAdmin, async (_req, res) => {
  const extensions = await db.select().from(domainExtensionsTable).orderBy(domainExtensionsTable.extension);
  res.json(extensions);
});

// GET /api/domain-extensions (public, active only)
router.get("/domain-extensions", async (_req, res) => {
  const extensions = await db.select().from(domainExtensionsTable)
    .where(eq(domainExtensionsTable.status, "active"))
    .orderBy(domainExtensionsTable.extension);
  res.json(extensions);
});

// POST /api/admin/domain-extensions
router.post("/admin/domain-extensions", authenticate, requireAdmin, async (req, res) => {
  const { extension, registerPrice, renewalPrice, transferPrice, status } = req.body;
  if (!extension || !registerPrice || !renewalPrice || !transferPrice) {
    return res.status(400).json({ error: "extension, registerPrice, renewalPrice, transferPrice are required" });
  }
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  try {
    const [record] = await db.insert(domainExtensionsTable).values({
      extension: ext.toLowerCase(),
      registerPrice: String(registerPrice),
      renewalPrice: String(renewalPrice),
      transferPrice: String(transferPrice),
      status: status || "active",
    }).returning();
    res.status(201).json(record);
  } catch (err: any) {
    if (err.code === "23505") return res.status(400).json({ error: "Extension already exists" });
    throw err;
  }
});

// PUT /api/admin/domain-extensions/:id
router.put("/admin/domain-extensions/:id", authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { extension, registerPrice, renewalPrice, transferPrice, status } = req.body;
  const updates: Record<string, unknown> = {};
  if (extension !== undefined) updates.extension = extension.startsWith(".") ? extension.toLowerCase() : `.${extension}`.toLowerCase();
  if (registerPrice !== undefined) updates.registerPrice = String(registerPrice);
  if (renewalPrice !== undefined) updates.renewalPrice = String(renewalPrice);
  if (transferPrice !== undefined) updates.transferPrice = String(transferPrice);
  if (status !== undefined) updates.status = status;
  updates.updatedAt = new Date();
  const [record] = await db.update(domainExtensionsTable).set(updates).where(eq(domainExtensionsTable.id, id)).returning();
  if (!record) return res.status(404).json({ error: "Not found" });
  res.json(record);
});

// DELETE /api/admin/domain-extensions/:id
router.delete("/admin/domain-extensions/:id", authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  await db.delete(domainExtensionsTable).where(eq(domainExtensionsTable.id, id));
  res.json({ success: true });
});

export default router;
