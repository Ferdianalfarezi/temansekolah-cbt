import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { cbtAuditLog } from "./cbt-audit-log";

export const cbtNotification = pgTable(
  "cbt_notification",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull(), // FK: tenant(id)
    recipientRole: varchar("recipient_role", { length: 20 })
      .notNull()
      .default("admin"),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull(),
    isHighPriority: boolean("is_high_priority").notNull().default(false),
    isRead: boolean("is_read").notNull().default(false),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    relatedAuditLogId: uuid("related_audit_log_id").references(
      () => cbtAuditLog.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => ({
    idxNotificationTenant: index("idx_cbt_notification_tenant").on(
      table.tenantId,
      table.isRead,
      table.createdAt,
    ),
  }),
);
