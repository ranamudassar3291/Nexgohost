import { db } from "@workspace/db";
import { activityLogsTable } from "@workspace/db/schema";
import type { Request } from "express";

export type ClientActivityAction =
  | "login_success"
  | "login_failed"
  | "login_2fa"
  | "password_change"
  | "2fa_enabled"
  | "2fa_disabled"
  | "logout"
  | "profile_update"
  | "order_placed"
  | "domain_registered"
  | "domain_transferred"
  | "domain_renewed"
  | "invoice_paid"
  | "ticket_opened"
  | "account_registered"
  | "password_reset_requested"
  | "support_ticket_created";

export async function logClientActivity(
  userId: string,
  userEmail: string,
  action: ClientActivityAction,
  description: string,
  req: Request,
  status: "success" | "failed" = "success",
): Promise<void> {
  try {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      null;
    const userAgent = (req.headers["user-agent"] as string) || null;
    await db.insert(activityLogsTable).values({
      userId,
      userEmail,
      action,
      description,
      ip,
      userAgent,
      status,
    });
  } catch {
    // Non-fatal — never block the caller
  }
}
