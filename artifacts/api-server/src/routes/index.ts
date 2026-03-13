import { Router, type IRouter } from "express";
import { routeLogger } from "../lib/auth.js";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import clientsRouter from "./clients.js";
import hostingRouter from "./hosting.js";
import domainsRouter from "./domains.js";
import ordersRouter from "./orders.js";
import invoicesRouter from "./invoices.js";
import ticketsRouter from "./tickets.js";
import migrationsRouter from "./migrations.js";
import dashboardRouter from "./dashboard.js";

const router: IRouter = Router();

// ─── Global Route Logger ──────────────────────────────────────────────────────
// Logs every request: method, path, user, role, status code, timing.
// Applied before all routes so every hit is captured automatically.
router.use(routeLogger);

// ─── Route Modules ────────────────────────────────────────────────────────────
// Each module owns its own path prefix and role guards internally.
// To add a new section: create a router file, import it here, then router.use() it.
router.use(healthRouter);
router.use(authRouter);
router.use(clientsRouter);
router.use(hostingRouter);
router.use(domainsRouter);
router.use(ordersRouter);
router.use(invoicesRouter);
router.use(ticketsRouter);
router.use(migrationsRouter);
router.use(dashboardRouter);

export default router;
