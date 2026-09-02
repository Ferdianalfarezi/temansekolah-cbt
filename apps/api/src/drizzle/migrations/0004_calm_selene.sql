CREATE TYPE "public"."cbt_tipe_soal" AS ENUM('pilihan_ganda', 'essay');--> statement-breakpoint
ALTER TABLE "cbt_question" DROP CONSTRAINT "chk_question_option_e";--> statement-breakpoint
ALTER TABLE "cbt_question" DROP CONSTRAINT "chk_jawaban_benar";--> statement-breakpoint
ALTER TABLE "cbt_question" DROP CONSTRAINT "chk_teks_soal_length";--> statement-breakpoint
ALTER TABLE "cbt_question" DROP CONSTRAINT "chk_opsi_a_length";--> statement-breakpoint
ALTER TABLE "cbt_question" DROP CONSTRAINT "chk_opsi_b_length";--> statement-breakpoint
ALTER TABLE "cbt_question" DROP CONSTRAINT "chk_opsi_c_length";--> statement-breakpoint
ALTER TABLE "cbt_question" DROP CONSTRAINT "chk_opsi_d_length";--> statement-breakpoint
ALTER TABLE "cbt_answer" DROP CONSTRAINT "chk_selected_option";--> statement-breakpoint
ALTER TABLE "cbt_question" ALTER COLUMN "opsi_a" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cbt_question" ALTER COLUMN "opsi_b" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cbt_question" ALTER COLUMN "opsi_c" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cbt_question" ALTER COLUMN "opsi_d" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cbt_question" ALTER COLUMN "jawaban_benar" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cbt_question" ADD COLUMN "tipe_soal" "cbt_tipe_soal" DEFAULT 'pilihan_ganda' NOT NULL;--> statement-breakpoint
ALTER TABLE "cbt_answer" ADD COLUMN "essay_answer" text;--> statement-breakpoint
ALTER TABLE "cbt_question" ADD CONSTRAINT "chk_question_type_validity" CHECK ((
        ("cbt_question"."tipe_soal" = 'pilihan_ganda' AND "cbt_question"."opsi_a" IS NOT NULL AND "cbt_question"."opsi_b" IS NOT NULL AND "cbt_question"."opsi_c" IS NOT NULL AND "cbt_question"."opsi_d" IS NOT NULL AND "cbt_question"."jawaban_benar" IS NOT NULL)
        OR
        ("cbt_question"."tipe_soal" = 'essay' AND "cbt_question"."opsi_a" IS NULL AND "cbt_question"."opsi_b" IS NULL AND "cbt_question"."opsi_c" IS NULL AND "cbt_question"."opsi_d" IS NULL AND "cbt_question"."opsi_e" IS NULL AND "cbt_question"."jawaban_benar" IS NULL)
      ));--> statement-breakpoint
ALTER TABLE "cbt_question" ADD CONSTRAINT "chk_question_option_e" CHECK (NOT ("cbt_question"."tipe_soal" = 'pilihan_ganda' AND "cbt_question"."opsi_e" IS NULL AND "cbt_question"."jawaban_benar" = 'E'));--> statement-breakpoint
ALTER TABLE "cbt_question" ADD CONSTRAINT "chk_jawaban_benar" CHECK ("cbt_question"."jawaban_benar" IS NULL OR "cbt_question"."jawaban_benar" IN ('A','B','C','D','E'));--> statement-breakpoint
ALTER TABLE "cbt_question" ADD CONSTRAINT "chk_teks_soal_length" CHECK (char_length("cbt_question"."teks_soal") BETWEEN 1 AND 10000);--> statement-breakpoint
ALTER TABLE "cbt_question" ADD CONSTRAINT "chk_opsi_a_length" CHECK ("cbt_question"."opsi_a" IS NULL OR char_length("cbt_question"."opsi_a") BETWEEN 1 AND 500);--> statement-breakpoint
ALTER TABLE "cbt_question" ADD CONSTRAINT "chk_opsi_b_length" CHECK ("cbt_question"."opsi_b" IS NULL OR char_length("cbt_question"."opsi_b") BETWEEN 1 AND 500);--> statement-breakpoint
ALTER TABLE "cbt_question" ADD CONSTRAINT "chk_opsi_c_length" CHECK ("cbt_question"."opsi_c" IS NULL OR char_length("cbt_question"."opsi_c") BETWEEN 1 AND 500);--> statement-breakpoint
ALTER TABLE "cbt_question" ADD CONSTRAINT "chk_opsi_d_length" CHECK ("cbt_question"."opsi_d" IS NULL OR char_length("cbt_question"."opsi_d") BETWEEN 1 AND 500);--> statement-breakpoint
ALTER TABLE "cbt_answer" ADD CONSTRAINT "chk_essay_answer_length" CHECK ("cbt_answer"."essay_answer" IS NULL OR char_length("cbt_answer"."essay_answer") <= 5000);--> statement-breakpoint
ALTER TABLE "cbt_answer" ADD CONSTRAINT "chk_selected_option" CHECK ("cbt_answer"."selected_option" IS NULL OR "cbt_answer"."selected_option" IN ('A','B','C','D','E'));