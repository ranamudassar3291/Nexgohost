import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, creditTransactionsTable, invoicesTable, settingsTable } from "@workspace/db/schema";
import { eq, desc, sql, and, or, ilike } from "drizzle-orm";
import { authenticate, requireRole, type AuthRequest } from "../lib/auth.js";

async function getWalletLimits(): Promise<{ min: number; max: number }> {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string> = {};
  for (const r of rows) if (r.key && r.value) map[r.key] = r.value;
  return {
    min: Number(map["wallet_min_deposit"] ?? "270"),
    max: Number(map["wallet_max_deposit"] ?? "100000"),
  };
}

const router = Router();

let invoiceCounter = 0;

// ── Client: Get my credit balance + transaction history ───────────────────────
router.get("/my/credits", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const [user] = await db.select({ creditBalance: usersTable.creditBalance })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const transactions = await db.select()
      .from(creditTransactionsTable)
      .where(eq(creditTransactionsTable.userId, userId))
      .orderBy(desc(creditTransactionsTable.createdAt))
      .limit(50);

    res.json({ creditBalance: user.creditBalance, transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Client: Generate a wallet deposit invoice (Add Funds) ─────────────────────
router.post("/my/credits/generate-invoice", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { amount } = req.body || {};
    const amt = parseFloat(amount);
    const limits = await getWalletLimits();
    if (isNaN(amt) || amt < limits.min || amt > limits.max) {
      res.status(400).json({ error: `Minimum deposit is Rs. ${limits.min.toLocaleString()}. Maximum is Rs. ${limits.max.toLocaleString()}.` }); return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    invoiceCounter++;
    const invoiceNumber = `DEP-${Date.now()}-${invoiceCounter}`;
    const due = new Date(); due.setDate(due.getDate() + 7);
    const items = [{ description: "Account Deposit", quantity: 1, unitPrice: amt, total: amt }];

    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber,
      clientId: userId,
      invoiceType: "deposit",
      amount: String(amt),
      tax: "0",
      total: String(amt),
      status: "unpaid",
      dueDate: due,
      items,
    }).returning();

    res.status(201).json({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      status: invoice.status,
      dueDate: invoice.dueDate,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Search clients with credit balances ────────────────────────────────
router.get("/admin/credits/clients", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { q } = req.query as { q?: string };
    const search = q?.trim();

    const whereClause = search
      ? and(
          eq(usersTable.role, "client"),
          or(
            ilike(usersTable.email, `%${search}%`),
            ilike(usersTable.firstName, `%${search}%`),
            ilike(usersTable.lastName, `%${search}%`)
          )
        )
      : eq(usersTable.role, "client");

    const clients = await db.select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      creditBalance: usersTable.creditBalance,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
    }).from(usersTable)
      .where(whereClause)
      .orderBy(desc(usersTable.createdAt))
      .limit(50);

    res.json({ clients });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Get any user's credit balance ──────────────────────────────────────
router.get("/admin/users/:id/credits", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select({ id: usersTable.id, creditBalance: usersTable.creditBalance })
      .from(usersTable).where(eq(usersTable.id, req.params.id!)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const transactions = await db.select()
      .from(creditTransactionsTable)
      .where(eq(creditTransactionsTable.userId, req.params.id!))
      .orderBy(desc(creditTransactionsTable.createdAt))
      .limit(100);

    res.json({ creditBalance: user.creditBalance, transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Manually add or deduct credits ─────────────────────────────────────
router.post("/admin/users/:id/credits", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { amount, type, description } = req.body || {};
    if (!amount || !type) { res.status(400).json({ error: "amount and type are required" }); return; }
    if (!["admin_add", "admin_deduct", "refund"].includes(type)) {
      res.status(400).json({ error: "type must be admin_add, admin_deduct, or refund" }); return;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { res.status(400).json({ error: "amount must be a positive number" }); return; }

    const [user] = await db.select({ id: usersTable.id, creditBalance: usersTable.creditBalance })
      .from(usersTable).where(eq(usersTable.id, req.params.id!)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const delta = type === "admin_deduct" ? -amt : amt;
    const newBalance = Math.max(0, parseFloat(user.creditBalance ?? "0") + delta);

    await db.update(usersTable)
      .set({ creditBalance: String(newBalance), updatedAt: new Date() })
      .where(eq(usersTable.id, req.params.id!));

    const [tx] = await db.insert(creditTransactionsTable).values({
      userId: req.params.id!,
      amount: String(amt),
      type,
      description: description || (type === "admin_add" ? "Bonus credit added by admin" : type === "admin_deduct" ? "Credits deducted by admin" : "Refund processed by admin"),
      performedBy: req.user!.userId,
    }).returning();

    res.status(201).json({ creditBalance: String(newBalance), transaction: tx });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
