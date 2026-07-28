import {
  pgTable,
  uuid,
  integer,
  boolean,
  text,
  timestamp,
  check,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  cbtExamSessionStatusEnum,
  cbtAntiCheatLevelEnum,
  cbtResultDetailLevelEnum,
} from "./enums";
import { cbtPelaksanaanUjian } from "./cbt-pelaksanaan-ujian";

export const cbtExamSession = pgTable(
  "cbt_exam_session",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").notNull(), // FK: tenant(id)
    pelaksanaanUjianId: uuid("pelaksanaan_ujian_id")
      .notNull()
      .references(() => cbtPelaksanaanUjian.id),
    mataPelajaranId: uuid("mata_pelajaran_id").notNull(), // FK: mata_pelajaran(id)
    kelasId: uuid("kelas_id").notNull(), // FK: kelas(id)
    proctorId: uuid("proctor_id").notNull(), // FK: user(id)
    status: cbtExamSessionStatusEnum("status").notNull().default("draft"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    randomizeQuestions: boolean("randomize_questions").notNull().default(false),
    randomizeOptions: boolean("randomize_options").notNull().default(false),
    antiCheatLevel: cbtAntiCheatLevelEnum("anti_cheat_level")
      .notNull()
      .default("standard"),
    resultDetailLevel: cbtResultDetailLevelEnum("result_detail_level")
      .notNull()
      .default("score_only"),
    resultsReleased: boolean("results_released").notNull().default(false),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
  },
  (table) => ({
    checkDuration: check(
      "chk_duration_minutes",
      sql`${table.durationMinutes} BETWEEN 5 AND 360`,
    ),
    idxSessionTenantStatus: index("idx_cbt_session_tenant_status").on(
      table.tenantId,
      table.status,
    ),
    idxSessionProctor: index("idx_cbt_session_proctor").on(
      table.proctorId,
      table.scheduledAt,
    ),
  }),
);
