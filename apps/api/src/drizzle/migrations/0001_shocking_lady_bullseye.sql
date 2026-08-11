CREATE TYPE "public"."siswa_status" AS ENUM('aktif', 'pindah_sekolah', 'keluar', 'lulus');--> statement-breakpoint
CREATE TYPE "public"."tahun_ajaran_status" AS ENUM('disiapkan', 'aktif', 'nonaktif');--> statement-breakpoint
CREATE TYPE "public"."tipe_komponen" AS ENUM('angka', 'huruf', 'deskripsi');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'admin', 'kepala_sekolah', 'guru', 'bendahara', 'orang_tua');--> statement-breakpoint
CREATE TYPE "public"."cbt_bank_soal_status" AS ENUM('draft', 'ready', 'archived');--> statement-breakpoint
CREATE TABLE "jadwal_pelajaran" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kelas_id" uuid NOT NULL,
	"mata_pelajaran_id" uuid,
	"guru_id" uuid,
	"tahun_ajaran_id" uuid NOT NULL,
	"semester" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kelas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tahun_ajaran_id" uuid NOT NULL,
	"nama" varchar(50) NOT NULL,
	"tingkat" integer NOT NULL,
	"wali_kelas_id" uuid
);
--> statement-breakpoint
CREATE TABLE "komponen_penilaian" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nama" varchar(100) NOT NULL,
	"tipe" "tipe_komponen" NOT NULL,
	"skala_min" integer,
	"skala_max" integer,
	"is_wajib" boolean DEFAULT true,
	"urutan" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "mata_pelajaran" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nama" varchar(100) NOT NULL,
	"kode" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "siswa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kelas_id" uuid,
	"nama" varchar(255) NOT NULL,
	"nisn" varchar(20),
	"tanggal_lahir" date,
	"status" "siswa_status" DEFAULT 'aktif'
);
--> statement-breakpoint
CREATE TABLE "tahun_ajaran" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nama" varchar(50) NOT NULL,
	"tanggal_mulai" date NOT NULL,
	"tanggal_selesai" date NOT NULL,
	"status" "tahun_ajaran_status" DEFAULT 'disiapkan' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"nama" varchar(255) NOT NULL,
	"email" varchar(255),
	"role" "user_role" NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "cbt_bank_soal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pelaksanaan_ujian_id" uuid NOT NULL,
	"mata_pelajaran_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"nama" varchar(255) NOT NULL,
	"tingkat" integer,
	"durasi_menit" integer NOT NULL,
	"kkm" integer DEFAULT 70 NOT NULL,
	"shuffle_questions" boolean DEFAULT false NOT NULL,
	"shuffle_options" boolean DEFAULT false NOT NULL,
	"status" "cbt_bank_soal_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	CONSTRAINT "chk_bank_soal_durasi" CHECK ("cbt_bank_soal"."durasi_menit" BETWEEN 5 AND 360),
	CONSTRAINT "chk_bank_soal_kkm" CHECK ("cbt_bank_soal"."kkm" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "cbt_bank_soal_kelas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_soal_id" uuid NOT NULL,
	"kelas_id" uuid NOT NULL,
	CONSTRAINT "uq_bank_soal_kelas" UNIQUE("bank_soal_id","kelas_id")
);
--> statement-breakpoint
ALTER TABLE "cbt_question" DROP CONSTRAINT "chk_question_scope";--> statement-breakpoint
ALTER TABLE "cbt_question" ALTER COLUMN "mata_pelajaran_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cbt_question" ADD COLUMN "bank_soal_id" uuid;--> statement-breakpoint
ALTER TABLE "cbt_bank_soal" ADD CONSTRAINT "cbt_bank_soal_pelaksanaan_ujian_id_cbt_pelaksanaan_ujian_id_fk" FOREIGN KEY ("pelaksanaan_ujian_id") REFERENCES "public"."cbt_pelaksanaan_ujian"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_bank_soal_kelas" ADD CONSTRAINT "cbt_bank_soal_kelas_bank_soal_id_cbt_bank_soal_id_fk" FOREIGN KEY ("bank_soal_id") REFERENCES "public"."cbt_bank_soal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cbt_bank_soal_tenant" ON "cbt_bank_soal" USING btree ("tenant_id","pelaksanaan_ujian_id");--> statement-breakpoint
CREATE INDEX "idx_cbt_bank_soal_mapel" ON "cbt_bank_soal" USING btree ("tenant_id","mata_pelajaran_id");--> statement-breakpoint
CREATE INDEX "idx_cbt_bank_soal_kelas" ON "cbt_bank_soal_kelas" USING btree ("bank_soal_id");--> statement-breakpoint
ALTER TABLE "cbt_question" ADD CONSTRAINT "cbt_question_bank_soal_id_cbt_bank_soal_id_fk" FOREIGN KEY ("bank_soal_id") REFERENCES "public"."cbt_bank_soal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cbt_question_bank_soal" ON "cbt_question" USING btree ("bank_soal_id","nomor_urut");