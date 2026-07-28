import {
  pgTable,
  uuid,
  integer,
  boolean,
  numeric,
  jsonb,
  varchar,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { cbtParticipantStatusEnum } from "./enums";
import { cbtExamSession } from "./cbt-exam-session";
import { cbtSiswaAccount } from "./cbt-siswa-account";

export const cbtExamParticipant = pgTable(
  "cbt_exam_participant",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    examSessionId: uuid("exam_session_id")
      .notNull()
      .references(() => cbtExamSession.id),
    siswaAccountId: uuid("siswa_account_id")
      .notNull()
      .references(() => cbtSiswaAccount.id),
    status: cbtParticipantStatusEnum("status").notNull().default("assigned"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    remainingSeconds: integer("remaining_seconds"),
    extensionSeconds: integer("extension_seconds").notNull().default(0),
    violationCount: integer("violation_count").notNull().default(0),
    isFlaggedCheating: boolean("is_flagged_cheating").notNull().default(false),
    isEarlySubmission: boolean("is_early_submission").notNull().default(false),
    scoreCorrect: integer("score_correct"),
    scoreTotal: integer("score_total"),
    scorePercentage: numeric("score_percentage", { precision: 5, scale: 2 }),
    randomizationMapping: jsonb("randomization_mapping"),
    submissionType: varchar("submission_type", { length: 20 }),
  },
  (table) => ({
    uniqueSessionSiswa: unique("uq_cbt_participant_session_siswa").on(
      table.examSessionId,
      table.siswaAccountId,
    ),
    idxParticipantSession: index("idx_cbt_participant_session").on(
      table.examSessionId,
      table.status,
    ),
    idxParticipantSiswa: index("idx_cbt_participant_siswa").on(
      table.siswaAccountId,
    ),
  }),
);
