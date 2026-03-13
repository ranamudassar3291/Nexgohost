import { Router } from "express";
import { db } from "@workspace/db";
import { currenciesTable } from "@workspace/db/schema";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/currencies (public)
router.get("/currencies", async (_req, res) => {
  const currencies = await db.select().from(currenciesTable).where(eq(currenciesTable.isActive, true)).orderBy(currenciesTable.code);
  res.json(currencies);
});

// GET /api/admin/currencies (admin, all)
router.get("/admin/currencies", authenticate, requireAdmin, async (_req, res) => {
  const currencies = await db.select().from(currenciesTable).orderBy(currenciesTable.code);
  res.json(currencies);
});

// POST /api/admin/currencies
router.post("/admin/currencies", authenticate, requireAdmin, async (req, res) => {
  const { code, name, symbol, exchangeRate, isDefault } = req.body;
  if (!code || !name || !symbol) return res.status(400).json({ error: "code, name, symbol are required" });

  if (isDefault) {
    await db.update(currenciesTable).set({ isDefault: false });
  }
  try {
    const [record] = await db.insert(currenciesTable).values({
      code: code.toUpperCase(),
      name,
      symbol,
      exchangeRate: String(exchangeRate || 1),
      isDefault: isDefault ?? false,
      isActive: true,
    }).returning();
    res.status(201).json(record);
  } catch (err: any) {
    if (err.code === "23505") return res.status(400).json({ error: "Currency code already exists" });
    throw err;
  }
});

// PUT /api/admin/currencies/:id
router.put("/admin/currencies/:id", authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { code, name, symbol, exchangeRate, isDefault, isActive } = req.body;
  if (isDefault) {
    await db.update(currenciesTable).set({ isDefault: false });
  }
  const updates: Record<string, unknown> = {};
  if (code !== undefined) updates.code = code.toUpperCase();
  if (name !== undefined) updates.name = name;
  if (symbol !== undefined) updates.symbol = symbol;
  if (exchangeRate !== undefined) updates.exchangeRate = String(exchangeRate);
  if (isDefault !== undefined) updates.isDefault = isDefault;
  if (isActive !== undefined) updates.isActive = isActive;
  const [record] = await db.update(currenciesTable).set(updates).where(eq(currenciesTable.id, id)).returning();
  if (!record) return res.status(404).json({ error: "Not found" });
  res.json(record);
});

// DELETE /api/admin/currencies/:id
router.delete("/admin/currencies/:id", authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  await db.delete(currenciesTable).where(eq(currenciesTable.id, id));
  res.json({ success: true });
});

export default router;
