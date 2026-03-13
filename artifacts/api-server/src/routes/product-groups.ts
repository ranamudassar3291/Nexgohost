import { Router } from "express";
import { db } from "@workspace/db";
import { productGroupsTable } from "@workspace/db/schema";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/admin/product-groups", authenticate, requireAdmin, async (_req, res) => {
  try {
    const groups = await db.select().from(productGroupsTable).orderBy(productGroupsTable.sortOrder);
    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/product-groups", async (_req, res) => {
  try {
    const groups = await db.select().from(productGroupsTable)
      .where(eq(productGroupsTable.isActive, true))
      .orderBy(productGroupsTable.sortOrder);
    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/product-groups", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, slug, description, isActive = true, sortOrder = 0 } = req.body;
    if (!name || !slug) { res.status(400).json({ error: "name and slug are required" }); return; }
    const [group] = await db.insert(productGroupsTable).values({
      name, slug: slug.toLowerCase().replace(/\s+/g, "-"), description, isActive, sortOrder,
    }).returning();
    res.status(201).json(group);
  } catch (err: any) {
    if (err.code === "23505") { res.status(400).json({ error: "Slug already exists" }); return; }
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/admin/product-groups/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, slug, description, isActive, sortOrder } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug.toLowerCase().replace(/\s+/g, "-");
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.isActive = isActive;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    const [updated] = await db.update(productGroupsTable).set(updates).where(eq(productGroupsTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/admin/product-groups/:id", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    await db.delete(productGroupsTable).where(eq(productGroupsTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
