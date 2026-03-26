import { Router } from "express";
import { db } from "@workspace/db";
import { serverNodesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, requireRole, type AuthRequest } from "../lib/auth.js";
import * as net from "net";
import * as http from "http";
import * as https from "https";

const router = Router();

async function checkNodeStatus(host: string, port: number, checkType: string): Promise<"online" | "offline"> {
  return new Promise((resolve) => {
    const timeout = 5000;
    try {
      if (checkType === "http" || checkType === "https") {
        const mod = checkType === "https" ? https : http;
        const req = mod.request(
          { hostname: host, port, path: "/", method: "HEAD", timeout },
          () => { resolve("online"); req.destroy(); }
        );
        req.on("error", () => resolve("offline"));
        req.on("timeout", () => { req.destroy(); resolve("offline"); });
        req.end();
      } else {
        const socket = new net.Socket();
        socket.setTimeout(timeout);
        socket.connect(port, host, () => { socket.destroy(); resolve("online"); });
        socket.on("error", () => { socket.destroy(); resolve("offline"); });
        socket.on("timeout", () => { socket.destroy(); resolve("offline"); });
      }
    } catch {
      resolve("offline");
    }
  });
}

// ── Public: Get all server statuses ──────────────────────────────────────────
router.get("/status/nodes", async (_req, res) => {
  try {
    const nodes = await db.select().from(serverNodesTable).where(eq(serverNodesTable.isActive, true));
    const results = await Promise.all(
      nodes.map(async (node) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        sortOrder: node.sortOrder,
        status: await checkNodeStatus(node.host, node.port, node.checkType),
      }))
    );
    res.json({ nodes: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: List nodes (with full details) ─────────────────────────────────────
router.get("/admin/server-nodes", authenticate, requireRole("admin"), async (_req, res) => {
  try {
    const nodes = await db.select().from(serverNodesTable);
    res.json({ nodes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Create node ────────────────────────────────────────────────────────
router.post("/admin/server-nodes", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { name, type = "hosting", host, port = 80, checkType = "http", isActive = true, sortOrder = 0 } = req.body;
    if (!name || !host) { res.status(400).json({ error: "name and host are required" }); return; }
    const [node] = await db.insert(serverNodesTable).values({ name, type, host, port, checkType, isActive, sortOrder }).returning();
    res.json({ node });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Update node ────────────────────────────────────────────────────────
router.put("/admin/server-nodes/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { name, type, host, port, checkType, isActive, sortOrder } = req.body;
    const [node] = await db.update(serverNodesTable)
      .set({ name, type, host, port, checkType, isActive, sortOrder, updatedAt: new Date() })
      .where(eq(serverNodesTable.id, req.params.id!))
      .returning();
    if (!node) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ node });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin: Delete node ────────────────────────────────────────────────────────
router.delete("/admin/server-nodes/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    await db.delete(serverNodesTable).where(eq(serverNodesTable.id, req.params.id!));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
