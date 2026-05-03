import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export interface ActivityData {
  userId: string;
  userEmail?: string;
  userName?: string;
  action: string;
  meta?: Record<string, any>;
}

export async function emitActivity(data: ActivityData): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO activity_stream (user_id, user_email, user_name, action, meta, created_at)
      VALUES (
        ${data.userId},
        ${data.userEmail ?? ""},
        ${data.userName ?? ""},
        ${data.action},
        ${JSON.stringify(data.meta ?? {})}::jsonb,
        NOW()
      )
    `);
  } catch {
    // Non-fatal — never block the caller
  }
}
