/**
 * 20i Module — barrel export
 * Re-exports the router and all public service functions + types.
 */

// Router (mount this in the main app)
export { default as twentyIRouter } from "./20i.routes.js";

// Service functions
export {
  testConnection,
  addServer,
  createAccount,
  suspendAccount,
  unsuspendAccount,
  terminateAccount,
  changePackage,
  singleSignOn,
  getPackages,
  getAccounts,
} from "./20i.service.js";

// Utility helpers
export { validateApiKey, classifyError, formatResponse, formatError, handleError } from "./20i.utils.js";

// Types
export type {
  ServerConfig,
  HostingAccount,
  Package,
  APIResponse,
  CreateHostingParams,
  CreateHostingResult,
  SSOResult,
} from "./20i.types.js";
