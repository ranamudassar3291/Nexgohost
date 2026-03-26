import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env["JWT_SECRET"] || "noehost-secret-key-change-in-production";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;

  // Standard bcrypt ($2a$ or $2b$ — Node.js native)
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$")) {
    return bcrypt.compare(password, hash);
  }
  // WHMCS PHP bcrypt: $2y$ is PHP's bcrypt — identical to $2b$ in content
  if (hash.startsWith("$2y$")) {
    return bcrypt.compare(password, hash.replace("$2y$", "$2b$"));
  }
  // WHMCS legacy MD5 double-hash: md5(md5(password))
  // Stored during import as "whmcs_md5:<32-char-hex>"
  if (hash.startsWith("whmcs_md5:")) {
    const { createHash } = await import("crypto");
    const md5Hash = hash.slice(10); // strip prefix
    const inner = createHash("md5").update(password).digest("hex");
    const outer = createHash("md5").update(inner).digest("hex");
    if (outer === md5Hash) return true;
    // Also try single md5 (some WHMCS installs)
    const single = createHash("md5").update(password).digest("hex");
    return single === md5Hash;
  }
  // Try bcrypt as last resort (handles any $2* variant we haven't caught)
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export interface TokenPayload {
  userId: string;
  role: string;
  email: string;
  adminPermission?: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

// ─── Route Logger ─────────────────────────────────────────────────────────────
// Logs every API request with method, path, user, role, and final status code.
// Applied globally in routes/index.ts so every route is covered automatically.
export function routeLogger(req: AuthRequest, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, path } = req;

  res.on("finish", () => {
    const ms = Date.now() - start;
    const user = req.user?.email ?? "anonymous";
    const role = req.user?.role ?? "none";
    const status = res.statusCode;
    const allowed = status < 400;
    const icon = allowed ? "✅" : status === 403 ? "🚫" : status === 401 ? "🔒" : "❌";

    console.log(
      `[ROUTE] ${method} ${path} | user=${user} | role=${role} | status=${status} ${icon} | ${ms}ms`
    );
  });

  next();
}

// ─── Authentication Middleware ────────────────────────────────────────────────
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "No token provided" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
  }
}

// ─── Role Guard Factory ───────────────────────────────────────────────────────
// Returns a middleware that requires a specific role.
// Usage: router.get("/admin/x", authenticate, requireRole("admin"), handler)
// Easy to extend: requireRole("partner"), requireRole("reseller"), etc.
export function requireRole(role: string) {
  return function roleGuard(req: AuthRequest, res: Response, next: NextFunction): void {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized", message: "Authentication required" });
      return;
    }
    // Super-admin bypass: full access regardless of required role
    if (req.user.adminPermission === "super_admin") {
      next();
      return;
    }
    if (req.user.role !== role) {
      res.status(403).json({
        error: "Forbidden",
        message: `Access denied. Required role: '${role}'. Your role: '${req.user.role}'.`,
        requiredRole: role,
        actualRole: req.user.role,
      });
      return;
    }
    next();
  };
}

// ─── Convenience Guards ───────────────────────────────────────────────────────
// Pre-built guards for the two built-in roles. Add more as roles expand.
export const requireAdmin = requireRole("admin");
export const requireClient = requireRole("client");
