import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const cbtSiswaAccount = pgTable(
  "cbt_siswa_account",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull(), // FK: tenant(id)
    siswaId: uuid("siswa_id").notNull(), // FK: siswa(id)
    nisn: varchar("nisn", { length: 20 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    mustChangePassword: boolean("must_change_password").notNull().default(true),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    needsReview: boolean("needs_review").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => ({
    uniqueTenantNisn: unique("uq_cbt_siswa_account_tenant_nisn").on(
      table.tenantId,
      table.nisn,
    ),
    idxSiswaAccountSiswa: index("idx_cbt_siswa_account_siswa").on(
      table.siswaId,
    ),
  }),
);
