import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, usersTable, hostingPlansTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireAdmin, type AuthRequest } from "../lib/auth.js";

const router = Router();

function formatOrder(o: typeof ordersTable.$inferSelect, clientName?: string) {
  return {
    id: o.id,
    clientId: o.clientId,
    clientName: clientName || "",
    type: o.type,
    itemName: o.itemName,
    amount: Number(o.amount),
    status: o.status,
    notes: o.notes,
    createdAt: o.createdAt.toISOString(),
  };
}

// Client: get my orders
router.get("/orders", authenticate, async (req: AuthRequest, res) => {
  try {
    const orders = await db.select().from(ordersTable).where(eq(ordersTable.clientId, req.user!.userId)).orderBy(sql`created_at DESC`);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    res.json(orders.map(o => formatOrder(o, user ? `${user.firstName} ${user.lastName}` : "")));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Client: create order
router.post("/orders", authenticate, async (req: AuthRequest, res) => {
  try {
    const { type, itemId, notes } = req.body;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    let itemName = "Order";
    let amount = 0;

    if (type === "hosting" && itemId) {
      const [plan] = await db.select().from(hostingPlansTable).where(eq(hostingPlansTable.id, itemId)).limit(1);
      if (plan) {
        itemName = plan.name;
        amount = Number(plan.price);
      }
    } else if (type === "domain") {
      itemName = itemId || "Domain registration";
      amount = 12.99;
    }

    const [order] = await db.insert(ordersTable).values({
      clientId: req.user!.userId,
      type,
      itemId,
      itemName,
      amount: String(amount),
      status: "pending",
      notes,
    }).returning();

    res.status(201).json(formatOrder(order, `${user.firstName} ${user.lastName}`));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: get all orders
router.get("/admin/orders", authenticate, requireAdmin, async (_req, res) => {
  try {
    const orders = await db.select().from(ordersTable).orderBy(sql`created_at DESC`);
    const result = await Promise.all(orders.map(async (o) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, o.clientId)).limit(1);
      return formatOrder(o, user ? `${user.firstName} ${user.lastName}` : "");
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: approve order
router.post("/admin/orders/:id/approve", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(ordersTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(ordersTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    res.json(formatOrder(updated, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: cancel order
router.post("/admin/orders/:id/cancel", authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(ordersTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(ordersTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.clientId)).limit(1);
    res.json(formatOrder(updated, user ? `${user.firstName} ${user.lastName}` : ""));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
