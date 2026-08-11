import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const cbtPelaksanaanUjian = pgTable(
  "cbt_pelaksanaan_ujian",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull(), // FK: tenant(id)
    tahunAjaranId: uuid("tahun_ajaran_id").notNull(), // FK: tahun_ajaran(id)
    periodeRapor: varchar("periode_rapor", { length: 20 }).notNull(),
    komponenPenilaianId: uuid("komponen_penilaian_id"), // FK: komponen_penilaian(id), nullable
    nama: varchar("nama", { length: 255 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => ({
    // Unique constraint: tenant + tahun_ajaran + periode (komponen no longer required)
    uniqueTenantPeriode: unique("uq_cbt_pu_tenant_periode").on(
      table.tenantId,
      table.tahunAjaranId,
      table.periodeRapor,
    ),
    idxActiveTenant: uniqueIndex("idx_cbt_pu_active_tenant")
      .on(table.tenantId)
      .where(sql`${table.isActive} = true`),
  }),
);
