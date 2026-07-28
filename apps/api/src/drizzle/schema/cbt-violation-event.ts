import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  check,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { cbtExamParticipant } from "./cbt-exam-participant";

export const cbtViolationEvent = pgTable(
  "cbt_violation_event",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => cbtExamParticipant.id),
    violationType: varchar("violation_type", { length: 30 }).notNull(),
    durationMs: integer("duration_ms"), // how long focus was lost
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => ({
    checkViolationType: check(
      "chk_violation_type",
      sql`${table.violationType} IN ('tab_switch', 'focus_loss', 'fullscreen_exit', 'multiple_login')`,
    ),
    idxViolationParticipant: index("idx_cbt_violation_participant").on(
      table.participantId,
      table.detectedAt,
    ),
  }),
);
