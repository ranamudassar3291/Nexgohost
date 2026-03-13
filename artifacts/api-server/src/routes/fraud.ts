import { Router } from "express";
import { db } from "@workspace/db";
import { fraudLogsTable, ordersTable } from "@workspace/db/schema";
import { authenticate, requireAdmin } from "../lib/auth.js";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/admin/fraud-logs", authenticate, requireAdmin, async (_req, res) => {
  try {
    const logs = await db.select().from(fraudLogsTable).orderBy(desc(fraudLogsTable.createdAt));
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/admin/fraud-logs/:id/approve", authenticate, requireAdmin, async (req, res) => {
  try {
    const [log] = await db.update(fraudLogsTable)
      .set({ status: "approved", reviewedAt: new Date() })
      .where(eq(fraudLogsTable.id, req.params.id))
      .returning();
    if (!log) return res.status(404).json({ error: "Not found" });
    await db.update(ordersTable).set({ status: "pending" }).where(eq(ordersTable.id, log.orderId));
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/admin/fraud-logs/:id/reject", authenticate, requireAdmin, async (req, res) => {
  try {
    const [log] = await db.update(fraudLogsTable)
      .set({ status: "rejected", reviewedAt: new Date() })
      .where(eq(fraudLogsTable.id, req.params.id))
      .returning();
    if (!log) return res.status(404).json({ error: "Not found" });
    await db.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, log.orderId));
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
