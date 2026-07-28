CREATE TYPE "public"."cbt_anti_cheat_level" AS ENUM('standard', 'relaxed');--> statement-breakpoint
CREATE TYPE "public"."cbt_exam_session_status" AS ENUM('draft', 'packaged', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."cbt_participant_status" AS ENUM('assigned', 'in_progress', 'paused', 'disconnected', 'submitted', 'auto_submitted');--> statement-breakpoint
CREATE TYPE "public"."cbt_result_detail_level" AS ENUM('score_only', 'score_with_indicator', 'full_detail');--> statement-breakpoint
CREATE TABLE "cbt_tenant_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"timezone" varchar(50) DEFAULT 'Asia/Jakarta' NOT NULL,
	"default_anti_cheat_level" varchar(10) DEFAULT 'standard' NOT NULL,
	"max_violation_count" integer DEFAULT 3 NOT NULL,
	"early_submission_threshold_pct" integer DEFAULT 20 NOT NULL,
	"default_result_detail_level" varchar(25) DEFAULT 'score_only' NOT NULL,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	CONSTRAINT "cbt_tenant_config_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "cbt_pelaksanaan_ujian" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tahun_ajaran_id" uuid NOT NULL,
	"periode_rapor" varchar(20) NOT NULL,
	"komponen_penilaian_id" uuid NOT NULL,
	"nama" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	CONSTRAINT "uq_cbt_pu_tenant_periode_komponen" UNIQUE("tenant_id","tahun_ajaran_id","periode_rapor","komponen_penilaian_id")
);
--> statement-breakpoint
CREATE TABLE "cbt_question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pelaksanaan_ujian_id" uuid NOT NULL,
	"mata_pelajaran_id" uuid NOT NULL,
	"tingkat" integer,
	"kelas_id" uuid,
	"created_by" uuid NOT NULL,
	"teks_soal" text NOT NULL,
	"gambar_soal_url" varchar(500),
	"opsi_a" text NOT NULL,
	"gambar_a_url" varchar(500),
	"opsi_b" text NOT NULL,
	"gambar_b_url" varchar(500),
	"opsi_c" text NOT NULL,
	"gambar_c_url" varchar(500),
	"opsi_d" text NOT NULL,
	"gambar_d_url" varchar(500),
	"opsi_e" text,
	"gambar_e_url" varchar(500),
	"jawaban_benar" char(1) NOT NULL,
	"nomor_urut" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	CONSTRAINT "chk_question_scope" CHECK ("cbt_question"."tingkat" IS NOT NULL OR "cbt_question"."kelas_id" IS NOT NULL),
	CONSTRAINT "chk_question_option_e" CHECK (NOT ("cbt_question"."opsi_e" IS NULL AND "cbt_question"."jawaban_benar" = 'E')),
	CONSTRAINT "chk_jawaban_benar" CHECK ("cbt_question"."jawaban_benar" IN ('A','B','C','D','E')),
	CONSTRAINT "chk_teks_soal_length" CHECK (char_length("cbt_question"."teks_soal") BETWEEN 1 AND 2000),
	CONSTRAINT "chk_opsi_a_length" CHECK (char_length("cbt_question"."opsi_a") BETWEEN 1 AND 500),
	CONSTRAINT "chk_opsi_b_length" CHECK (char_length("cbt_question"."opsi_b") BETWEEN 1 AND 500),
	CONSTRAINT "chk_opsi_c_length" CHECK (char_length("cbt_question"."opsi_c") BETWEEN 1 AND 500),
	CONSTRAINT "chk_opsi_d_length" CHECK (char_length("cbt_question"."opsi_d") BETWEEN 1 AND 500),
	CONSTRAINT "chk_opsi_e_length" CHECK ("cbt_question"."opsi_e" IS NULL OR char_length("cbt_question"."opsi_e") BETWEEN 1 AND 500)
);
--> statement-breakpoint
CREATE TABLE "cbt_exam_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pelaksanaan_ujian_id" uuid NOT NULL,
	"mata_pelajaran_id" uuid NOT NULL,
	"kelas_id" uuid NOT NULL,
	"proctor_id" uuid NOT NULL,
	"status" "cbt_exam_session_status" DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"randomize_questions" boolean DEFAULT false NOT NULL,
	"randomize_options" boolean DEFAULT false NOT NULL,
	"anti_cheat_level" "cbt_anti_cheat_level" DEFAULT 'standard' NOT NULL,
	"result_detail_level" "cbt_result_detail_level" DEFAULT 'score_only' NOT NULL,
	"results_released" boolean DEFAULT false NOT NULL,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	CONSTRAINT "chk_duration_minutes" CHECK ("cbt_exam_session"."duration_minutes" BETWEEN 5 AND 360)
);
--> statement-breakpoint
CREATE TABLE "cbt_exam_session_question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"nomor_urut" integer NOT NULL,
	CONSTRAINT "uq_cbt_esq_session_question" UNIQUE("exam_session_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "cbt_siswa_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"siswa_id" uuid NOT NULL,
	"nisn" varchar(20) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	CONSTRAINT "uq_cbt_siswa_account_tenant_nisn" UNIQUE("tenant_id","nisn")
);
--> statement-breakpoint
CREATE TABLE "cbt_exam_participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_session_id" uuid NOT NULL,
	"siswa_account_id" uuid NOT NULL,
	"status" "cbt_participant_status" DEFAULT 'assigned' NOT NULL,
	"started_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"remaining_seconds" integer,
	"extension_seconds" integer DEFAULT 0 NOT NULL,
	"violation_count" integer DEFAULT 0 NOT NULL,
	"is_flagged_cheating" boolean DEFAULT false NOT NULL,
	"is_early_submission" boolean DEFAULT false NOT NULL,
	"score_correct" integer,
	"score_total" integer,
	"score_percentage" numeric(5, 2),
	"randomization_mapping" jsonb,
	"submission_type" varchar(20),
	CONSTRAINT "uq_cbt_participant_session_siswa" UNIQUE("exam_session_id","siswa_account_id")
);
--> statement-breakpoint
CREATE TABLE "cbt_answer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option" char(1),
	"is_correct" boolean,
	"answered_at" timestamp with time zone,
	CONSTRAINT "uq_cbt_answer_participant_question" UNIQUE("participant_id","question_id"),
	CONSTRAINT "chk_selected_option" CHECK ("cbt_answer"."selected_option" IN ('A','B','C','D','E'))
);
--> statement-breakpoint
CREATE TABLE "cbt_answer_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"current_question_index" integer,
	"remaining_seconds" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cbt_violation_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"violation_type" varchar(30) NOT NULL,
	"duration_ms" integer,
	"detected_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	CONSTRAINT "chk_violation_type" CHECK ("cbt_violation_event"."violation_type" IN ('tab_switch', 'focus_loss', 'fullscreen_exit', 'multiple_login'))
);
--> statement-breakpoint
CREATE TABLE "cbt_proctor_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_session_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"proctor_id" uuid NOT NULL,
	"action_type" varchar(20) NOT NULL,
	"extension_minutes" integer,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	CONSTRAINT "chk_action_type" CHECK ("cbt_proctor_action"."action_type" IN ('pause', 'resume', 'extend')),
	CONSTRAINT "chk_reason_length" CHECK (char_length("cbt_proctor_action"."reason") BETWEEN 1 AND 500)
);
--> statement-breakpoint
CREATE TABLE "cbt_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"actor_id" uuid NOT NULL,
	"actor_type" varchar(20) NOT NULL,
	"actor_role" varchar(20) NOT NULL,
	"action" varchar(30) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" uuid,
	"resource_ids" uuid[],
	"before_value" jsonb,
	"after_value" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	CONSTRAINT "chk_actor_type" CHECK ("cbt_audit_log"."actor_type" IN ('staff', 'siswa', 'system'))
);
--> statement-breakpoint
CREATE TABLE "cbt_notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"recipient_role" varchar(20) DEFAULT 'admin' NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"is_high_priority" boolean DEFAULT false NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"related_audit_log_id" uuid,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cbt_question" ADD CONSTRAINT "cbt_question_pelaksanaan_ujian_id_cbt_pelaksanaan_ujian_id_fk" FOREIGN KEY ("pelaksanaan_ujian_id") REFERENCES "public"."cbt_pelaksanaan_ujian"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_exam_session" ADD CONSTRAINT "cbt_exam_session_pelaksanaan_ujian_id_cbt_pelaksanaan_ujian_id_fk" FOREIGN KEY ("pelaksanaan_ujian_id") REFERENCES "public"."cbt_pelaksanaan_ujian"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_exam_session_question" ADD CONSTRAINT "cbt_exam_session_question_exam_session_id_cbt_exam_session_id_fk" FOREIGN KEY ("exam_session_id") REFERENCES "public"."cbt_exam_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_exam_session_question" ADD CONSTRAINT "cbt_exam_session_question_question_id_cbt_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."cbt_question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_exam_participant" ADD CONSTRAINT "cbt_exam_participant_exam_session_id_cbt_exam_session_id_fk" FOREIGN KEY ("exam_session_id") REFERENCES "public"."cbt_exam_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_exam_participant" ADD CONSTRAINT "cbt_exam_participant_siswa_account_id_cbt_siswa_account_id_fk" FOREIGN KEY ("siswa_account_id") REFERENCES "public"."cbt_siswa_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_answer" ADD CONSTRAINT "cbt_answer_participant_id_cbt_exam_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."cbt_exam_participant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_answer" ADD CONSTRAINT "cbt_answer_question_id_cbt_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."cbt_question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_answer_snapshot" ADD CONSTRAINT "cbt_answer_snapshot_participant_id_cbt_exam_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."cbt_exam_participant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_violation_event" ADD CONSTRAINT "cbt_violation_event_participant_id_cbt_exam_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."cbt_exam_participant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_proctor_action" ADD CONSTRAINT "cbt_proctor_action_exam_session_id_cbt_exam_session_id_fk" FOREIGN KEY ("exam_session_id") REFERENCES "public"."cbt_exam_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_proctor_action" ADD CONSTRAINT "cbt_proctor_action_participant_id_cbt_exam_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."cbt_exam_participant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_notification" ADD CONSTRAINT "cbt_notification_related_audit_log_id_cbt_audit_log_id_fk" FOREIGN KEY ("related_audit_log_id") REFERENCES "public"."cbt_audit_log"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cbt_pu_active_tenant" ON "cbt_pelaksanaan_ujian" USING btree ("tenant_id") WHERE "cbt_pelaksanaan_ujian"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_cbt_question_bank" ON "cbt_question" USING btree ("pelaksanaan_ujian_id","mata_pelajaran_id","tingkat");--> statement-breakpoint
CREATE INDEX "idx_cbt_question_kelas" ON "cbt_question" USING btree ("pelaksanaan_ujian_id","mata_pelajaran_id","kelas_id");--> statement-breakpoint
CREATE INDEX "idx_cbt_session_tenant_status" ON "cbt_exam_session" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_cbt_session_proctor" ON "cbt_exam_session" USING btree ("proctor_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_cbt_esq_session" ON "cbt_exam_session_question" USING btree ("exam_session_id","nomor_urut");--> statement-breakpoint
CREATE INDEX "idx_cbt_siswa_account_siswa" ON "cbt_siswa_account" USING btree ("siswa_id");--> statement-breakpoint
CREATE INDEX "idx_cbt_participant_session" ON "cbt_exam_participant" USING btree ("exam_session_id","status");--> statement-breakpoint
CREATE INDEX "idx_cbt_participant_siswa" ON "cbt_exam_participant" USING btree ("siswa_account_id");--> statement-breakpoint
CREATE INDEX "idx_cbt_answer_participant" ON "cbt_answer" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "idx_cbt_snapshot_participant" ON "cbt_answer_snapshot" USING btree ("participant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_cbt_violation_participant" ON "cbt_violation_event" USING btree ("participant_id","detected_at");--> statement-breakpoint
CREATE INDEX "idx_cbt_audit_tenant_time" ON "cbt_audit_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_cbt_audit_actor" ON "cbt_audit_log" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_cbt_audit_resource" ON "cbt_audit_log" USING btree ("resource_type","resource_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_cbt_notification_tenant" ON "cbt_notification" USING btree ("tenant_id","is_read","created_at");