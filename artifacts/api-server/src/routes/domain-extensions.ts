import { Router } from "express";
import { db } from "@workspace/db";
import { domainExtensionsTable } from "@workspace/db/schema";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { eq } from "drizzle-orm";

const router = Router();

function formatExt(row: typeof domainExtensionsTable.$inferSelect) {
  return {
    id: row.id,
    extension: row.extension,
    registerPrice: row.registerPrice,
    register2YearPrice: row.register2YearPrice,
    register3YearPrice: row.register3YearPrice,
    renewalPrice: row.renewalPrice,
    renew2YearPrice: row.renew2YearPrice,
    renew3YearPrice: row.renew3YearPrice,
    transferPrice: row.transferPrice,
    privacyEnabled: row.privacyEnabled,
    isFreeWithHosting: row.isFreeWithHosting ?? false,
    transferAllowed: row.transferAllowed ?? true,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// GET /api/admin/domain-extensions
router.get("/admin/domain-extensions", authenticate, requireAdmin, async (_req, res) => {
  const extensions = await db.select().from(domainExtensionsTable).orderBy(domainExtensionsTable.extension);
  res.json(extensions.map(formatExt));
});

// GET /api/domain-extensions (public, active only)
router.get("/domain-extensions", async (_req, res) => {
  const extensions = await db.select().from(domainExtensionsTable)
    .where(eq(domainExtensionsTable.status, "active"))
    .orderBy(domainExtensionsTable.extension);
  res.json(extensions.map(formatExt));
});

// POST /api/admin/domain-extensions
router.post("/admin/domain-extensions", authenticate, requireAdmin, async (req, res) => {
  const { extension, registerPrice, register2YearPrice, register3YearPrice,
          renewalPrice, renew2YearPrice, renew3YearPrice, transferPrice,
          privacyEnabled, isFreeWithHosting, transferAllowed, status } = req.body;
  if (!extension || !registerPrice || !renewalPrice || !transferPrice) {
    return res.status(400).json({ error: "extension, registerPrice, renewalPrice, transferPrice are required" });
  }
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  try {
    const [record] = await db.insert(domainExtensionsTable).values({
      extension: ext.toLowerCase(),
      registerPrice: String(registerPrice),
      register2YearPrice: register2YearPrice ? String(register2YearPrice) : null,
      register3YearPrice: register3YearPrice ? String(register3YearPrice) : null,
      renewalPrice: String(renewalPrice),
      renew2YearPrice: renew2YearPrice ? String(renew2YearPrice) : null,
      renew3YearPrice: renew3YearPrice ? String(renew3YearPrice) : null,
      transferPrice: String(transferPrice),
      privacyEnabled: privacyEnabled !== undefined ? Boolean(privacyEnabled) : true,
      isFreeWithHosting: isFreeWithHosting !== undefined ? Boolean(isFreeWithHosting) : false,
      transferAllowed: transferAllowed !== undefined ? Boolean(transferAllowed) : true,
      status: status || "active",
    }).returning();
    res.status(201).json(formatExt(record));
  } catch (err: any) {
    if (err.code === "23505") return res.status(400).json({ error: "Extension already exists" });
    throw err;
  }
});

// PUT /api/admin/domain-extensions/:id
router.put("/admin/domain-extensions/:id", authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { extension, registerPrice, register2YearPrice, register3YearPrice,
          renewalPrice, renew2YearPrice, renew3YearPrice, transferPrice,
          status, privacyEnabled, isFreeWithHosting, transferAllowed } = req.body;
  const updates: Record<string, unknown> = {};
  if (extension !== undefined) updates.extension = extension.startsWith(".") ? extension.toLowerCase() : `.${extension}`.toLowerCase();
  if (registerPrice !== undefined) updates.registerPrice = String(registerPrice);
  if (register2YearPrice !== undefined) updates.register2YearPrice = register2YearPrice ? String(register2YearPrice) : null;
  if (register3YearPrice !== undefined) updates.register3YearPrice = register3YearPrice ? String(register3YearPrice) : null;
  if (renewalPrice !== undefined) updates.renewalPrice = String(renewalPrice);
  if (renew2YearPrice !== undefined) updates.renew2YearPrice = renew2YearPrice ? String(renew2YearPrice) : null;
  if (renew3YearPrice !== undefined) updates.renew3YearPrice = renew3YearPrice ? String(renew3YearPrice) : null;
  if (transferPrice !== undefined) updates.transferPrice = String(transferPrice);
  if (status !== undefined) updates.status = status;
  if (privacyEnabled !== undefined) updates.privacyEnabled = Boolean(privacyEnabled);
  if (isFreeWithHosting !== undefined) updates.isFreeWithHosting = Boolean(isFreeWithHosting);
  if (transferAllowed !== undefined) updates.transferAllowed = Boolean(transferAllowed);
  updates.updatedAt = new Date();
  const [record] = await db.update(domainExtensionsTable).set(updates).where(eq(domainExtensionsTable.id, id)).returning();
  if (!record) return res.status(404).json({ error: "Not found" });
  res.json(formatExt(record));
});

// DELETE /api/admin/domain-extensions/:id
router.delete("/admin/domain-extensions/:id", authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  await db.delete(domainExtensionsTable).where(eq(domainExtensionsTable.id, id));
  res.json({ success: true });
});

export default router;
