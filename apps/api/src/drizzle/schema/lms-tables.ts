/**
 * LMS-owned tables — READ-ONLY references for CBT.
 *
 * These tables are owned by the LMS database and should NOT be included
 * in CBT migrations. They already exist in the shared PostgreSQL instance.
 *
 * Only columns relevant to CBT operations are defined here.
 * drizzle-kit is configured with `tablesFilter: ["cbt_*"]` so these
 * will be excluded from migration generation.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  boolean,
  date,
  timestamp,
  jsonb,
  text,
  decimal,
  unique,
  index,
} from "drizzle-orm/pg-core";

// ─── LMS Enums ──────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "admin",
  "kepala_sekolah",
  "guru",
  "bendahara",
  "orang_tua",
]);

export const siswaStatusEnum = pgEnum("siswa_status", [
  "aktif",
  "pindah_sekolah",
  "keluar",
  "lulus",
]);

export const tahunAjaranStatusEnum = pgEnum("tahun_ajaran_status", [
  "disiapkan",
  "aktif",
  "nonaktif",
]);

export const periodeRaporEnum = pgEnum("periode_rapor", [
  "uts_semester_1",
  "semester_1",
  "uts_semester_2",
  "semester_2",
]);

export const statusRaporEnum = pgEnum("status_rapor", ["draft", "final"]);

export const statusNilaiEnum = pgEnum("status_nilai", ["draft", "submitted"]);

export const tipeKomponenEnum = pgEnum("tipe_komponen", [
  "angka",
  "huruf",
  "deskripsi",
]);

// ─── LMS Tables ─────────────────────────────────────────────────────────────

export const tenant = pgTable("tenant", {
  id: uuid("id").primaryKey().defaultRandom(),
  nama: varchar("nama", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true),
});

export const user = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  nama: varchar("nama", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  role: userRoleEnum("role").notNull(),
  isActive: boolean("is_active").default(true),
});

export const tahunAjaran = pgTable("tahun_ajaran", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  nama: varchar("nama", { length: 50 }).notNull(),
  tanggalMulai: date("tanggal_mulai").notNull(),
  tanggalSelesai: date("tanggal_selesai").notNull(),
  status: tahunAjaranStatusEnum("status").notNull().default("disiapkan"),
});

export const kelas = pgTable("kelas", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  tahunAjaranId: uuid("tahun_ajaran_id").notNull(),
  nama: varchar("nama", { length: 50 }).notNull(),
  tingkat: integer("tingkat").notNull(),
  waliKelasId: uuid("wali_kelas_id"),
});

export const siswa = pgTable("siswa", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  kelasId: uuid("kelas_id"),
  nama: varchar("nama", { length: 255 }).notNull(),
  nisn: varchar("nisn", { length: 20 }),
  tanggalLahir: date("tanggal_lahir"),
  status: siswaStatusEnum("status").default("aktif"),
});

export const mataPelajaran = pgTable("mata_pelajaran", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  nama: varchar("nama", { length: 100 }).notNull(),
  kode: varchar("kode", { length: 20 }),
});

export const jadwalPelajaran = pgTable("jadwal_pelajaran", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  kelasId: uuid("kelas_id").notNull(),
  mataPelajaranId: uuid("mata_pelajaran_id"),
  guruId: uuid("guru_id"),
  tahunAjaranId: uuid("tahun_ajaran_id").notNull(),
  semester: integer("semester").notNull(),
});

export const komponenPenilaian = pgTable("komponen_penilaian", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  nama: varchar("nama", { length: 100 }).notNull(),
  tipe: tipeKomponenEnum("tipe").notNull(),
  skalaMin: integer("skala_min"),
  skalaMax: integer("skala_max"),
  isWajib: boolean("is_wajib").default(true),
  urutan: integer("urutan").default(0),
});

export const rapor = pgTable("rapor", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  kelasId: uuid("kelas_id").notNull(),
  tahunAjaranId: uuid("tahun_ajaran_id").notNull(),
  periode: periodeRaporEnum("periode").notNull(),
  status: statusRaporEnum("status").notNull().default("draft"),
});

export const raporNilai = pgTable(
  "rapor_nilai",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    raporId: uuid("rapor_id").notNull(),
    siswaId: uuid("siswa_id").notNull(),
    mataPelajaranId: uuid("mata_pelajaran_id").notNull(),
    guruId: uuid("guru_id").notNull(),
    komponenNilai: jsonb("komponen_nilai").notNull(),
    status: statusNilaiEnum("status").notNull().default("draft"),
  },
  (table) => ({
    uniqueRaporSiswaMapelTenant: unique("rapor_nilai_upsert_unique").on(
      table.raporId,
      table.siswaId,
      table.mataPelajaranId,
      table.tenantId,
    ),
  }),
);
