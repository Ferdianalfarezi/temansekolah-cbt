import {
  pgTable,
  uuid,
  integer,
  text,
  varchar,
  char,
  timestamp,
  check,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { cbtPelaksanaanUjian } from "./cbt-pelaksanaan-ujian";
import { cbtBankSoal } from "./cbt-bank-soal";

export const cbtQuestion = pgTable(
  "cbt_question",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull(), // FK: tenant(id)
    pelaksanaanUjianId: uuid("pelaksanaan_ujian_id")
      .notNull()
      .references(() => cbtPelaksanaanUjian.id),
    bankSoalId: uuid("bank_soal_id").references(() => cbtBankSoal.id, {
      onDelete: "cascade",
    }),
    mataPelajaranId: uuid("mata_pelajaran_id"), // Made nullable for deprecation
    tingkat: integer("tingkat"), // NULL if kelas-specific
    kelasId: uuid("kelas_id"), // FK: kelas(id) — NULL if tingkat-level
    createdBy: uuid("created_by").notNull(), // FK: user(id)
    teksSoal: text("teks_soal").notNull(),
    gambarSoalUrl: varchar("gambar_soal_url", { length: 500 }),
    opsiA: text("opsi_a").notNull(),
    gambarAUrl: varchar("gambar_a_url", { length: 500 }),
    opsiB: text("opsi_b").notNull(),
    gambarBUrl: varchar("gambar_b_url", { length: 500 }),
    opsiC: text("opsi_c").notNull(),
    gambarCUrl: varchar("gambar_c_url", { length: 500 }),
    opsiD: text("opsi_d").notNull(),
    gambarDUrl: varchar("gambar_d_url", { length: 500 }),
    opsiE: text("opsi_e"), // nullable — CHECK null or length 1-500
    gambarEUrl: varchar("gambar_e_url", { length: 500 }),
    jawabanBenar: char("jawaban_benar", { length: 1 }).notNull(),
    nomorUrut: integer("nomor_urut").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => ({
    // Index for bank_soal lookup
    idxQuestionBankSoal: index("idx_cbt_question_bank_soal").on(
      table.bankSoalId,
      table.nomorUrut,
    ),
    // Can't answer E without option E
    checkOptionE: check(
      "chk_question_option_e",
      sql`NOT (${table.opsiE} IS NULL AND ${table.jawabanBenar} = 'E')`,
    ),
    // jawaban_benar must be A-E
    checkJawabanBenar: check(
      "chk_jawaban_benar",
      sql`${table.jawabanBenar} IN ('A','B','C','D','E')`,
    ),
    // text length checks
    checkTeksSoal: check(
      "chk_teks_soal_length",
      sql`char_length(${table.teksSoal}) BETWEEN 1 AND 2000`,
    ),
    checkOpsiA: check(
      "chk_opsi_a_length",
      sql`char_length(${table.opsiA}) BETWEEN 1 AND 500`,
    ),
    checkOpsiB: check(
      "chk_opsi_b_length",
      sql`char_length(${table.opsiB}) BETWEEN 1 AND 500`,
    ),
    checkOpsiC: check(
      "chk_opsi_c_length",
      sql`char_length(${table.opsiC}) BETWEEN 1 AND 500`,
    ),
    checkOpsiD: check(
      "chk_opsi_d_length",
      sql`char_length(${table.opsiD}) BETWEEN 1 AND 500`,
    ),
    checkOpsiE: check(
      "chk_opsi_e_length",
      sql`${table.opsiE} IS NULL OR char_length(${table.opsiE}) BETWEEN 1 AND 500`,
    ),
    // Indexes for question bank lookups
    idxQuestionBank: index("idx_cbt_question_bank").on(
      table.pelaksanaanUjianId,
      table.mataPelajaranId,
      table.tingkat,
    ),
    idxQuestionKelas: index("idx_cbt_question_kelas").on(
      table.pelaksanaanUjianId,
      table.mataPelajaranId,
      table.kelasId,
    ),
  }),
);
