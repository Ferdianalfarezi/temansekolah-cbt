import axios from "axios";
import { useAuthStore } from "@/stores/auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  headers: { "Content-Type": "application/json" },
});

// Inject JWT token from auth store on each request
api.interceptors.request.use((config) => {
  const authStore = useAuthStore();
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`;
  }
  return config;
});

// Handle 401 responses - redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore();
      authStore.clearAuth();

      // Redirect to login with current path as redirect param
      const currentPath = window.location.pathname;
      if (currentPath !== "/login") {
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      }
    }
    return Promise.reject(error);
  },
);

// ─── Pelaksanaan Ujian ───────────────────────────────────────────────────────

export interface PelaksanaanUjian {
  id: string;
  tenantId: string;
  tahunAjaranId: string;
  periodeRapor: string;
  komponenPenilaianId: string | null;
  nama: string;
  isActive: boolean;
  createdAt: string;
}

export interface TahunAjaran {
  id: string;
  nama: string;
  tanggalMulai: string;
  tanggalSelesai: string;
}

export function getPelaksanaanUjianList(params?: {
  periodeRapor?: string;
  isActive?: string;
}) {
  return api.get<PelaksanaanUjian[]>("/pelaksanaan-ujian", { params });
}

export function createPelaksanaanUjian(data: { periodeRapor: string }) {
  return api.post<PelaksanaanUjian>("/pelaksanaan-ujian", data);
}

export function deactivatePelaksanaanUjian(id: string) {
  return api.patch(`/pelaksanaan-ujian/${id}/deactivate`);
}

export function getActivePelaksanaanUjian() {
  return api.get<PelaksanaanUjian | null>("/pelaksanaan-ujian/active");
}

export function getTahunAjaranAktif() {
  return api.get<TahunAjaran | null>("/pelaksanaan-ujian/tahun-ajaran-aktif");
}

// ─── Exam Sessions ───────────────────────────────────────────────────────────

export type ExamSessionStatus =
  "draft" | "packaged" | "active" | "completed" | "cancelled";

export interface ExamSession {
  id: string;
  pelaksanaanUjianId: string;
  mataPelajaranId: string;
  kelasId: string;
  proctorId: string;
  status: ExamSessionStatus;
  scheduledAt: string;
  durationMinutes: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  antiCheatLevel: string;
  resultDetailLevel: string;
  resultsReleased: boolean;
  createdAt: string;
  // Joined readable names
  kelasNama?: string;
  mataPelajaranNama?: string;
  proctorNama?: string;
}

export interface ExamSessionListResponse {
  data: ExamSession[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function getExamSessions(params?: {
  status?: ExamSessionStatus;
  pelaksanaanUjianId?: string;
}) {
  return api.get<ExamSessionListResponse>("/exam-sessions", { params });
}

export function createExamSession(data: Partial<ExamSession>) {
  return api.post<ExamSession>("/exam-sessions", data);
}

export function batchCreateExamSessions(data: {
  pelaksanaanUjianId: string;
  mataPelajaranId: string;
  kelasIds: string[];
  proctorId: string;
  scheduledAt: string;
  durationMinutes: number;
  randomizeQuestions?: boolean;
  randomizeOptions?: boolean;
}) {
  return api.post<ExamSession[]>("/exam-sessions/batch", data);
}

export function packageSession(id: string) {
  return api.post(`/exam-sessions/${id}/package`);
}

export function unpackageSession(id: string) {
  return api.post(`/exam-sessions/${id}/unpackage`);
}

export function cancelSession(id: string, reason: string) {
  return api.post(`/exam-sessions/${id}/cancel`, { reason });
}

export function releaseResults(id: string) {
  return api.post(`/exam-sessions/${id}/release-results`);
}

export function getExamSessionReport(id: string) {
  return api.get(`/exam-sessions/${id}/report`);
}

// ─── Questions (Bank Soal) ───────────────────────────────────────────────────

export interface Question {
  id: string;
  pelaksanaanUjianId: string;
  mataPelajaranId: string;
  tingkat: number | null;
  kelasId: string | null;
  teksSoal: string;
  gambarSoalUrl: string | null;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  opsiD: string;
  opsiE: string | null;
  jawabanBenar: string;
  nomorUrut: number;
  createdAt: string;
}

export interface QuestionsResponse {
  data: Question[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function getQuestions(params?: {
  pelaksanaanUjianId?: string;
  mataPelajaranId?: string;
  tingkat?: number;
  kelasId?: string;
}) {
  return api.get<QuestionsResponse>("/questions", { params });
}

export function createQuestion(data: Partial<Question>) {
  return api.post<Question>("/questions", data);
}

export function updateQuestion(id: string, data: Partial<Question>) {
  return api.put<Question>(`/questions/${id}`, data);
}

export function deleteQuestion(id: string) {
  return api.delete(`/questions/${id}`);
}

export function importQuestionsPreview(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return api.post<{ questions: Partial<Question>[]; errors: string[] }>(
    "/questions/import",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
}

export function confirmImportQuestions(questions: Partial<Question>[]) {
  return api.post("/questions/import/confirm", { questions });
}

export function downloadQuestionTemplate() {
  return api.get("/questions/template", { responseType: "blob" });
}

// ─── Siswa Account ───────────────────────────────────────────────────────────

export interface SiswaAccount {
  id: string;
  tenantId: string;
  siswaId: string;
  nisn: string;
  mustChangePassword: boolean;
  isActive: boolean;
  needsReview: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  // Joined fields
  namaSiswa?: string;
  kelasNama?: string;
}

export interface SiswaAccountListResponse {
  data: SiswaAccount[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function getSiswaAccounts(params?: {
  search?: string;
  isActive?: boolean;
  needsReview?: boolean;
}) {
  return api.get<SiswaAccountListResponse>("/siswa-accounts", { params });
}

export function syncSiswaAccounts() {
  return api.post("/siswa-accounts/sync");
}

export function resetSiswaPassword(id: string) {
  return api.post(`/siswa-accounts/${id}/reset-password`);
}

// ─── Configuration ───────────────────────────────────────────────────────────

export interface CbtConfig {
  id: string;
  tenantId: string;
  timezone: string;
  defaultAntiCheatLevel: string;
  maxViolationCount: number;
  earlySubmissionThresholdPct: number;
  defaultResultDetailLevel: string;
}

export function getCbtConfig() {
  return api.get<CbtConfig>("/config");
}

export function updateCbtConfig(data: Partial<CbtConfig>) {
  return api.patch<CbtConfig>("/config", data);
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface CbtNotification {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  isHighPriority: boolean;
  isRead: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  data: CbtNotification[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function getNotifications() {
  return api.get<NotificationListResponse>("/notifications");
}

export function acknowledgeNotification(id: string) {
  return api.patch(`/notifications/${id}/acknowledge`);
}

export function getUnreadNotificationCount() {
  return api.get<{ count: number }>("/notifications/unread-count");
}

// ─── Proctor Dashboard ───────────────────────────────────────────────────────

export interface ParticipantDashboardData {
  id: string;
  siswaAccountId: string;
  namaSiswa: string;
  nisn: string;
  status: string;
  startedAt: string | null;
  remainingSeconds: number | null;
  violationCount: number;
  isFlaggedCheating: boolean;
  isEarlySubmission: boolean;
  scorePercentage: number | null;
}

export interface ProctorDashboardData {
  session: ExamSession;
  participants: ParticipantDashboardData[];
  stats: {
    total: number;
    inProgress: number;
    submitted: number;
    disconnected: number;
    flagged: number;
  };
}

export function getProctorDashboard(sessionId: string) {
  return api.get<ProctorDashboardData>(
    `/proctor/sessions/${sessionId}/dashboard`,
  );
}

export function pauseParticipant(
  sessionId: string,
  participantId: string,
  reason: string,
) {
  return api.post(
    `/proctor/sessions/${sessionId}/participants/${participantId}/pause`,
    { reason },
  );
}

export function resumeParticipant(
  sessionId: string,
  participantId: string,
  reason: string,
) {
  return api.post(
    `/proctor/sessions/${sessionId}/participants/${participantId}/resume`,
    { reason },
  );
}

export function extendParticipant(
  sessionId: string,
  participantId: string,
  data: { minutes: number; reason: string },
) {
  return api.post(
    `/proctor/sessions/${sessionId}/participants/${participantId}/extend`,
    data,
  );
}

// ─── Result Export ───────────────────────────────────────────────────────────

/**
 * Triggers download of exam session results as Excel file.
 * Validates: Requirements 6.4 - Export with blob response and Content-Disposition header
 */
export async function exportSessionResults(
  sessionId: string,
  detail: boolean = false,
): Promise<void> {
  const url = `/exam-sessions/${sessionId}/export${detail ? "?detail=true" : ""}`;
  const response = await api.get(url, { responseType: "blob" });

  // Extract filename from Content-Disposition header
  const disposition = response.headers["content-disposition"];
  const filename =
    disposition?.match(/filename="(.+)"/)?.[1] || "hasil-ujian.xlsx";

  // Trigger download
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Triggers download of all exam session results in a Pelaksanaan Ujian as Excel file.
 * Validates: Requirements 6.4 - Export with blob response and Content-Disposition header
 */
export async function exportPelaksanaanUjianResults(
  pelaksanaanUjianId: string,
  detail: boolean = false,
): Promise<void> {
  const url = `/pelaksanaan-ujian/${pelaksanaanUjianId}/export${detail ? "?detail=true" : ""}`;
  const response = await api.get(url, { responseType: "blob" });

  // Extract filename from Content-Disposition header
  const disposition = response.headers["content-disposition"];
  const filename =
    disposition?.match(/filename="(.+)"/)?.[1] || "hasil-ujian.xlsx";

  // Trigger download
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default api;
