import { ExamSessionStatus, AntiCheatLevel, ResultDetailLevel } from "../enums";

/**
 * Basic ExamSession shape shared between API and frontends.
 */
export interface ExamSession {
  id: string;
  tenantId: string;
  pelaksanaanUjianId: string;
  mataPelajaranId: string;
  kelasId: string;
  proctorId: string;
  status: ExamSessionStatus;
  scheduledAt: string; // ISO 8601
  durationMinutes: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  antiCheatLevel: AntiCheatLevel;
  resultDetailLevel: ResultDetailLevel;
  resultsReleased: boolean;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
}
