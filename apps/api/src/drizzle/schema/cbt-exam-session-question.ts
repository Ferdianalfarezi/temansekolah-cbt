import { pgTable, uuid, integer, unique, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { cbtExamSession } from "./cbt-exam-session";
import { cbtQuestion } from "./cbt-question";

export const cbtExamSessionQuestion = pgTable(
  "cbt_exam_session_question",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    examSessionId: uuid("exam_session_id")
      .notNull()
      .references(() => cbtExamSession.id),
    questionId: uuid("question_id")
      .notNull()
      .references(() => cbtQuestion.id),
    nomorUrut: integer("nomor_urut").notNull(),
  },
  (table) => ({
    uniqueSessionQuestion: unique("uq_cbt_esq_session_question").on(
      table.examSessionId,
      table.questionId,
    ),
    idxEsqSession: index("idx_cbt_esq_session").on(
      table.examSessionId,
      table.nomorUrut,
    ),
  }),
);
