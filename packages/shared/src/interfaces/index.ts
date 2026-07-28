export type { JwtPayload, SiswaJwtPayload } from "./auth.interface";
export type { ExamSession } from "./exam-session.interface";
export type { Question, QuestionOption } from "./question.interface";
export type {
  // Siswa → Server
  JoinSessionPayload,
  HeartbeatPayload,
  AnswerSavePayload,
  AnswerSnapshotPayload,
  ViolationReportPayload,
  // Server → Siswa
  SessionStartedPayload,
  TimerPausedPayload,
  TimerResumedPayload,
  TimerExtendedPayload,
  ForceSubmitPayload,
  SessionTerminatedPayload,
  SaveConfirmedPayload,
  // Server → Proctor
  ParticipantUpdatePayload,
  ViolationAlertPayload,
  ParticipantDisconnectedPayload,
  ParticipantReconnectedPayload,
  EarlySubmissionPayload,
  SessionCompletedPayload,
} from "./websocket-events.interface";
