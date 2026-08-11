-- Bank Soal status enum (idempotent)
DO $$ BEGIN
    CREATE TYPE "public"."cbt_bank_soal_status" AS ENUM('draft', 'ready', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Bank Soal main table
CREATE TABLE IF NOT EXISTS "cbt_bank_soal" (
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
);--> statement-breakpoint

-- Bank Soal to Kelas junction table
CREATE TABLE IF NOT EXISTS "cbt_bank_soal_kelas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_soal_id" uuid NOT NULL,
	"kelas_id" uuid NOT NULL,
	CONSTRAINT "uq_bank_soal_kelas" UNIQUE("bank_soal_id","kelas_id")
);--> statement-breakpoint

-- Update cbt_question to support Bank Soal
ALTER TABLE "cbt_question" DROP CONSTRAINT IF EXISTS "chk_question_scope";--> statement-breakpoint
ALTER TABLE "cbt_question" ALTER COLUMN "mata_pelajaran_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cbt_question" ADD COLUMN IF NOT EXISTS "bank_soal_id" uuid;--> statement-breakpoint

-- Foreign key constraints (idempotent)
DO $$ BEGIN
    ALTER TABLE "cbt_bank_soal" ADD CONSTRAINT "cbt_bank_soal_pelaksanaan_ujian_id_cbt_pelaksanaan_ujian_id_fk" FOREIGN KEY ("pelaksanaan_ujian_id") REFERENCES "public"."cbt_pelaksanaan_ujian"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
    ALTER TABLE "cbt_bank_soal_kelas" ADD CONSTRAINT "cbt_bank_soal_kelas_bank_soal_id_cbt_bank_soal_id_fk" FOREIGN KEY ("bank_soal_id") REFERENCES "public"."cbt_bank_soal"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
    ALTER TABLE "cbt_question" ADD CONSTRAINT "cbt_question_bank_soal_id_cbt_bank_soal_id_fk" FOREIGN KEY ("bank_soal_id") REFERENCES "public"."cbt_bank_soal"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS "idx_cbt_bank_soal_tenant" ON "cbt_bank_soal" USING btree ("tenant_id","pelaksanaan_ujian_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cbt_bank_soal_mapel" ON "cbt_bank_soal" USING btree ("tenant_id","mata_pelajaran_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cbt_bank_soal_kelas" ON "cbt_bank_soal_kelas" USING btree ("bank_soal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cbt_question_bank_soal" ON "cbt_question" USING btree ("bank_soal_id","nomor_urut");
