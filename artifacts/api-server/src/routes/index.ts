import { Router, type IRouter } from "express";
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
