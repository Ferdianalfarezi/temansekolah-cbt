import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { cbtExamSession } from "./cbt-exam-session";
import { cbtExamParticipant } from "./cbt-exam-participant";

export const cbtProctorAction = pgTable(
  "cbt_proctor_action",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    examSessionId: uuid("exam_session_id")
      .notNull()
      .references(() => cbtExamSession.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => cbtExamParticipant.id),
    proctorId: uuid("proctor_id").notNull(), // FK: user(id)
    actionType: varchar("action_type", { length: 20 }).notNull(),
    extensionMinutes: integer("extension_minutes"), // only for 'extend'
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => ({
    checkActionType: check(
      "chk_action_type",
      sql`${table.actionType} IN ('pause', 'resume', 'extend')`,
    ),
    checkReasonLength: check(
      "chk_reason_length",
      sql`char_length(${table.reason}) BETWEEN 1 AND 500`,
    ),
  }),
);
