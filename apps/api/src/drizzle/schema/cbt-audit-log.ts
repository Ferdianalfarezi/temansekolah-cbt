import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  check,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const cbtAuditLog = pgTable(
  "cbt_audit_log",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id"), // FK: tenant(id) — NULL for cross-tenant superadmin queries
    actorId: uuid("actor_id").notNull(), // user or siswa_account id
    actorType: varchar("actor_type", { length: 20 }).notNull(),
    actorRole: varchar("actor_role", { length: 20 }).notNull(),
    action: varchar("action", { length: 30 }).notNull(), // 'read', 'create', 'update', 'delete', 'login', 'query'
    resourceType: varchar("resource_type", { length: 50 }).notNull(),
    resourceId: uuid("resource_id"),
    resourceIds: uuid("resource_ids").array(), // for batch reads (e.g., viewing question list)
    beforeValue: jsonb("before_value"),
    afterValue: jsonb("after_value"),
    metadata: jsonb("metadata"), // additional context (filter params, IP, etc.)
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => ({
    checkActorType: check(
      "chk_actor_type",
      sql`${table.actorType} IN ('staff', 'siswa', 'system')`,
    ),
    idxAuditTenantTime: index("idx_cbt_audit_tenant_time").on(
      table.tenantId,
      table.createdAt,
    ),
    idxAuditActor: index("idx_cbt_audit_actor").on(
      table.actorId,
      table.createdAt,
    ),
    idxAuditResource: index("idx_cbt_audit_resource").on(
      table.resourceType,
      table.resourceId,
      table.createdAt,
    ),
  }),
);
