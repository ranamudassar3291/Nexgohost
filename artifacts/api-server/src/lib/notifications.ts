import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";

type NotificationType = "invoice" | "ticket" | "domain" | "affiliate" | "order" | "payment" | "system" | "security";

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string,
): Promise<void> {
  try {
    await db.insert(notificationsTable).values({ userId, type, title, message, link: link || null });
  } catch {
    // Non-fatal — never let notification failure break main flow
  }
}
