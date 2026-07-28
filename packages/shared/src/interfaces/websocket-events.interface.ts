import { ViolationType, ParticipantStatus } from "../enums";

// ─── Siswa → Server Events ───────────────────────────────────────────────────

export interface JoinSessionPayload {
  sessionId: string;
  token: string;
}

export interface HeartbeatPayload {
  timestamp: string;
}

export interface AnswerSavePayload {
  questionId: string;
  option: "A" | "B" | "C" | "D" | "E";
  timestamp: string;
}

export interface AnswerSnapshotPayload {
  answers: Record<string, { option: string; timestamp: string }>;
  questionIndex: number;
  remainingSeconds: number;
}

export interface ViolationReportPayload {
  type: ViolationType;
  timestamp: string;
  durationMs?: number;
}

// ─── Server → Siswa Events ───────────────────────────────────────────────────

export interface SessionStartedPayload {
  questions: Array<{
    id: string;
    teksSoal: string;
    gambarSoalUrl?: string | null;
    options: Array<{
      label: string;
      text: string;
      imageUrl?: string | null;
    }>;
  }>;
  startedAt: string;
  durationSeconds: number;
}

export interface TimerPausedPayload {
  reason: string;
}

export interface TimerResumedPayload {
  remainingSeconds: number;
}

export interface TimerExtendedPayload {
  additionalSeconds: number;
  newTotal: number;
}

export interface ForceSubmitPayload {
  reason: string;
}

export interface SessionTerminatedPayload {
  reason: string;
}

export interface SaveConfirmedPayload {
  questionId: string;
  timestamp: string;
}

// ─── Server → Proctor Events ─────────────────────────────────────────────────

export interface ParticipantUpdatePayload {
  participantId: string;
  status: ParticipantStatus;
  violationCount: number;
  isFlagged: boolean;
  remainingSeconds?: number;
}

export interface ViolationAlertPayload {
  participantId: string;
  type: ViolationType;
  count: number;
  timestamp: string;
}

export interface ParticipantDisconnectedPayload {
  participantId: string;
  lastHeartbeat: string;
}

export interface ParticipantReconnectedPayload {
  participantId: string;
}

export interface EarlySubmissionPayload {
  participantId: string;
  durationPct: number;
}

export interface SessionCompletedPayload {
  sessionId: string;
}
