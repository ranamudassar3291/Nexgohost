/**
 * 20i Module — Route definitions
 *
 * All routes require admin authentication.
 *
 * POST /api/20i/test           — test API key connection
 * POST /api/20i/add-server     — add & save 20i server (test + save flow)
 * POST /api/20i/create         — create hosting account
 * POST /api/20i/suspend        — suspend hosting account
 * POST /api/20i/unsuspend      — unsuspend hosting account
 * POST /api/20i/terminate      — terminate hosting account
 * POST /api/20i/change-package — change hosting package
 * GET  /api/20i/packages       — list available packages
 * GET  /api/20i/accounts       — list all hosting accounts
 * GET  /api/20i/sso/:siteId    — get SSO URL for a site
 */
import { Router } from "express";
import { authenticate, requireAdmin } from "../../lib/auth.js";
import {
  handleTestConnection,
  handleAddServer,
  handleCreateHosting,
  handleSuspendHosting,
  handleUnsuspendHosting,
  handleTerminateHosting,
  handleChangePackage,
  handleSingleSignOn,
  handleGetPackages,
  handleGetAccounts,
} from "./20i.controller.js";

const router = Router();

// Apply auth to all 20i module routes
router.use(authenticate as any, requireAdmin as any);

// ─── Connection ───────────────────────────────────────────────────────────────

/**
 * @route   POST /api/20i/test
 * @desc    Test 20i API key connection
 * @body    { apiKey: string } | { serverId: string }
 * @returns { success, message, data: { packageCount } }
 */
router.post("/20i/test", handleTestConnection as any);

/**
 * @route   POST /api/20i/add-server
 * @desc    Test API key, then save server to database
 * @body    { name: string, apiKey: string, ns1?, ns2?, isDefault? }
 * @returns { success, message: "20i Server Connected", serverId, packageCount }
 */
router.post("/20i/add-server", handleAddServer as any);

// ─── Hosting lifecycle ────────────────────────────────────────────────────────

/**
 * @route   POST /api/20i/create
 * @desc    Create a new hosting account
 * @body    { apiKey, domain, email, packageId?, stackUserId? }
 * @returns { success, message, siteId, cpanelUrl, webmailUrl }
 */
router.post("/20i/create", handleCreateHosting as any);

/**
 * @route   POST /api/20i/suspend
 * @desc    Suspend a hosting account
 * @body    { apiKey, siteId }
 */
router.post("/20i/suspend", handleSuspendHosting as any);

/**
 * @route   POST /api/20i/unsuspend
 * @desc    Unsuspend a hosting account
 * @body    { apiKey, siteId }
 */
router.post("/20i/unsuspend", handleUnsuspendHosting as any);

/**
 * @route   POST /api/20i/terminate
 * @desc    Terminate (delete) a hosting account
 * @body    { apiKey, siteId }
 */
router.post("/20i/terminate", handleTerminateHosting as any);

/**
 * @route   POST /api/20i/change-package
 * @desc    Change the package for a hosting account
 * @body    { apiKey, siteId, packageId }
 */
router.post("/20i/change-package", handleChangePackage as any);

// ─── Read operations ──────────────────────────────────────────────────────────

/**
 * @route   GET /api/20i/packages
 * @desc    List available reseller packages
 * @query   apiKey=xxx  (or body.apiKey or body.serverId)
 */
router.get("/20i/packages", handleGetPackages as any);

/**
 * @route   GET /api/20i/accounts
 * @desc    List all hosting accounts under this reseller
 * @query   apiKey=xxx  (or body.apiKey or body.serverId)
 */
router.get("/20i/accounts", handleGetAccounts as any);

/**
 * @route   GET /api/20i/sso/:siteId
 * @desc    Get single sign-on URL to manage a site in StackCP
 * @query   apiKey=xxx
 */
router.get("/20i/sso/:siteId", handleSingleSignOn as any);

export default router;
