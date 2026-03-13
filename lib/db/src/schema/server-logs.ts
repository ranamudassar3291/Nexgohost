import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const serverLogsTable = pgTable("server_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  serviceId: text("service_id"),
  serverId: text("server_id"),
  action: text("action").notNull(),
  status: text("status").notNull().default("success"),
  request: text("request"),
  response: text("response"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ServerLog = typeof serverLogsTable.$inferSelect;
