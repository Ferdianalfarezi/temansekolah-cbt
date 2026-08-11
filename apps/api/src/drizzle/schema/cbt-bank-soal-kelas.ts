import { pgTable, uuid, unique, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { cbtBankSoal } from "./cbt-bank-soal";

export const cbtBankSoalKelas = pgTable(
  "cbt_bank_soal_kelas",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    bankSoalId: uuid("bank_soal_id")
      .notNull()
      .references(() => cbtBankSoal.id, { onDelete: "cascade" }),
    kelasId: uuid("kelas_id").notNull(), // FK to LMS kelas
  },
  (table) => ({
    uniqueBankSoalKelas: unique("uq_bank_soal_kelas").on(
      table.bankSoalId,
      table.kelasId,
    ),
    idxBankSoalKelas: index("idx_cbt_bank_soal_kelas").on(table.bankSoalId),
  }),
);
