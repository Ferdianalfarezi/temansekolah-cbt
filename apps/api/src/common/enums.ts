/**
 * Local enum definitions — mirrors @cbt/shared enums.
 * Used instead of the workspace package to avoid CJS/ESM resolution issues in production.
 */

export enum CbtRole {
  SUPERADMIN = "superadmin",
  ADMIN_SEKOLAH = "admin_sekolah",
  GURU = "guru",
  SISWA = "siswa",
}

export enum ExamSessionStatus {
  DRAFT = "draft",
  PACKAGED = "packaged",
  ACTIVE = "active",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum ParticipantStatus {
  ASSIGNED = "assigned",
  IN_PROGRESS = "in_progress",
  PAUSED = "paused",
  DISCONNECTED = "disconnected",
  SUBMITTED = "submitted",
  AUTO_SUBMITTED = "auto_submitted",
}

export enum ViolationType {
  TAB_SWITCH = "tab_switch",
  FOCUS_LOSS = "focus_loss",
  FULLSCREEN_EXIT = "fullscreen_exit",
  MULTIPLE_LOGIN = "multiple_login",
}

export enum AntiCheatLevel {
  STANDARD = "standard",
  RELAXED = "relaxed",
}

export enum ResultDetailLevel {
  SCORE_ONLY = "score_only",
  SCORE_WITH_INDICATOR = "score_with_indicator",
  FULL_DETAIL = "full_detail",
}

export enum PeriodeRapor {
  UTS_SEMESTER_1 = "uts_semester_1",
  SEMESTER_1 = "semester_1",
  UTS_SEMESTER_2 = "uts_semester_2",
  SEMESTER_2 = "semester_2",
}
