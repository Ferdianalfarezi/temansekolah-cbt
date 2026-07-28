import {
  pgTable,
  uuid,
  jsonb,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { cbtExamParticipant } from "./cbt-exam-participant";

export const cbtAnswerSnapshot = pgTable(
  "cbt_answer_snapshot",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => cbtExamParticipant.id),
    answers: jsonb("answers").notNull(), // {questionId: {option: 'A', timestamp: '...'}}
    currentQuestionIndex: integer("current_question_index"),
    remainingSeconds: integer("remaining_seconds").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => ({
    idxSnapshotParticipant: index("idx_cbt_snapshot_participant").on(
      table.participantId,
      table.createdAt,
    ),
  }),
);
