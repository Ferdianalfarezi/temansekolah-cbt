import {
  pgTable,
  pgEnum,
  uuid,
  integer,
  varchar,
  boolean,
  timestamp,
  check,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { cbtPelaksanaanUjian } from "./cbt-pelaksanaan-ujian";

export const cbtBankSoalStatusEnum = pgEnum("cbt_bank_soal_status", [
  "draft",
  "ready",
  "archived",
]);

export const cbtBankSoal = pgTable(
  "cbt_bank_soal",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull(), // FK: tenant(id)
    pelaksanaanUjianId: uuid("pelaksanaan_ujian_id")
      .notNull()
      .references(() => cbtPelaksanaanUjian.id),
    mataPelajaranId: uuid("mata_pelajaran_id").notNull(), // FK: mata_pelajaran(id)
    createdBy: uuid("created_by").notNull(), // FK: user(id)

    nama: varchar("nama", { length: 255 }).notNull(),
    tingkat: integer("tingkat"), // NULL if using specific kelas
    durasiMenit: integer("durasi_menit").notNull(),
    kkm: integer("kkm").notNull().default(70),
    shuffleQuestions: boolean("shuffle_questions").notNull().default(false),
    shuffleOptions: boolean("shuffle_options").notNull().default(false),
    status: cbtBankSoalStatusEnum("status").notNull().default("draft"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => ({
    // Validations
    checkDurasi: check(
      "chk_bank_soal_durasi",
      sql`${table.durasiMenit} BETWEEN 5 AND 360`,
    ),
    checkKkm: check("chk_bank_soal_kkm", sql`${table.kkm} BETWEEN 0 AND 100`),
    // Indexes
    idxBankSoalTenant: index("idx_cbt_bank_soal_tenant").on(
      table.tenantId,
      table.pelaksanaanUjianId,
    ),
    idxBankSoalMapel: index("idx_cbt_bank_soal_mapel").on(
      table.tenantId,
      table.mataPelajaranId,
    ),
  }),
);
