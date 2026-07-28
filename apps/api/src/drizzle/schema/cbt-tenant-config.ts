import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const cbtTenantConfig = pgTable("cbt_tenant_config", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().unique(), // FK: tenant(id)
  timezone: varchar("timezone", { length: 50 })
    .notNull()
    .default("Asia/Jakarta"),
  defaultAntiCheatLevel: varchar("default_anti_cheat_level", { length: 10 })
    .notNull()
    .default("standard"),
  maxViolationCount: integer("max_violation_count").notNull().default(3),
  earlySubmissionThresholdPct: integer("early_submission_threshold_pct")
    .notNull()
    .default(20),
  defaultResultDetailLevel: varchar("default_result_detail_level", {
    length: 25,
  })
    .notNull()
    .default("score_only"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`NOW()`),
});
