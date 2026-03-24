import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env["JWT_SECRET"] || "noehost-secret-key-change-in-production";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: { userId: string; role: string; email: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: string; role: string; email: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: string; role: string; email: string };
}

export interface AuthRequest extends Request {
  user?: { userId: string; role: string; email: string };
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
