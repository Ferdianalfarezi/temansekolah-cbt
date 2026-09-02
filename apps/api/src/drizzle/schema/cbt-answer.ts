import {
  pgTable,
  uuid,
  char,
  text,
  boolean,
  timestamp,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { cbtExamParticipant } from "./cbt-exam-participant";
import { cbtQuestion } from "./cbt-question";

export const cbtAnswer = pgTable(
  "cbt_answer",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => cbtExamParticipant.id),
    questionId: uuid("question_id")
      .notNull()
      .references(() => cbtQuestion.id),
    selectedOption: char("selected_option", { length: 1 }), // For PG questions
    essayAnswer: text("essay_answer"), // For essay questions
    isCorrect: boolean("is_correct"), // NULL for essay (not auto-graded)
    answeredAt: timestamp("answered_at", { withTimezone: true }),
  },
  (table) => ({
    uniqueParticipantQuestion: unique("uq_cbt_answer_participant_question").on(
      table.participantId,
      table.questionId,
    ),
    idxAnswerParticipant: index("idx_cbt_answer_participant").on(
      table.participantId,
    ),
    // selected_option must be A-E or NULL (for essay or unanswered)
    checkSelectedOption: check(
      "chk_selected_option",
      sql`${table.selectedOption} IS NULL OR ${table.selectedOption} IN ('A','B','C','D','E')`,
    ),
    // essay_answer max 5000 characters
    checkEssayAnswerLength: check(
      "chk_essay_answer_length",
      sql`${table.essayAnswer} IS NULL OR char_length(${table.essayAnswer}) <= 5000`,
    ),
  }),
);
