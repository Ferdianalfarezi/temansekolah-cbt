import { pgEnum } from "drizzle-orm/pg-core";

export const cbtExamSessionStatusEnum = pgEnum("cbt_exam_session_status", [
  "draft",
  "packaged",
  "active",
  "completed",
  "cancelled",
]);

export const cbtAntiCheatLevelEnum = pgEnum("cbt_anti_cheat_level", [
  "standard",
  "relaxed",
]);

export const cbtResultDetailLevelEnum = pgEnum("cbt_result_detail_level", [
  "score_only",
  "score_with_indicator",
  "full_detail",
]);

export const cbtParticipantStatusEnum = pgEnum("cbt_participant_status", [
  "assigned",
  "in_progress",
  "paused",
  "disconnected",
  "submitted",
  "auto_submitted",
]);
