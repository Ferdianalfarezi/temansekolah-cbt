import axios, { type AxiosResponse } from "axios";
import { useAuthStore } from "@/stores/auth";

/**
 * Bank Soal API Client
 *
 * API methods for managing Bank Soal (question bank) entities.
 * Follows the same pattern as cbt.ts with JWT token injection and 401 handling.
 */

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

// ─── Types ───────────────────────────────────────────────────────────────────

export type BankSoalStatus = "draft" | "ready" | "archived";

export interface BankSoal {
  id: string;
  nama: string;
  mataPelajaranId: string;
  mataPelajaranNama: string;
  soalCount: number;
  targetKelas: string[];
  targetKelasIds: string[];
  tingkat: number | null;
  durasiMenit: number;
  kkm: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  status: BankSoalStatus;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Soal {
  id: string;
  nomorUrut: number;
  teksSoal: string;
  jawabanBenar: "A" | "B" | "C" | "D" | "E";
  opsiA: string;
  opsiB: string;
  opsiC: string;
  opsiD: string;
  opsiE: string | null;
  gambarSoalUrl: string | null;
  gambarAUrl: string | null;
  gambarBUrl: string | null;
  gambarCUrl: string | null;
  gambarDUrl: string | null;
  gambarEUrl: string | null;
}

export interface BankSoalDetail extends BankSoal {
  soalList: Soal[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BankSoalListResponse {
  data: BankSoal[];
  meta: PaginationMeta;
}

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface CreateBankSoalDto {
  nama: string;
  mataPelajaranId: string;
  tingkat?: number;
  targetKelasIds?: string[];
  durasiMenit: number;
  kkm: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
}

export interface UpdateBankSoalDto {
  nama?: string;
  tingkat?: number;
  targetKelasIds?: string[];
  durasiMenit?: number;
  kkm?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
}

export interface ListBankSoalQueryDto {
  mataPelajaranId?: string;
  tingkat?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ScheduleExamDto {
  scheduledAt: string; // ISO date string
  kelasId: string;
  proctorId?: string;
}

export interface CreateSoalDto {
  teksSoal: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  opsiD: string;
  opsiE?: string;
  jawabanBenar: "A" | "B" | "C" | "D" | "E";
  gambarSoalUrl?: string;
  gambarAUrl?: string;
  gambarBUrl?: string;
  gambarCUrl?: string;
  gambarDUrl?: string;
  gambarEUrl?: string;
}

export interface UpdateSoalDto {
  teksSoal?: string;
  opsiA?: string;
  opsiB?: string;
  opsiC?: string;
  opsiD?: string;
  opsiE?: string | null;
  jawabanBenar?: "A" | "B" | "C" | "D" | "E";
  gambarSoalUrl?: string | null;
  gambarAUrl?: string | null;
  gambarBUrl?: string | null;
  gambarCUrl?: string | null;
  gambarDUrl?: string | null;
  gambarEUrl?: string | null;
}

// ─── Import Types ────────────────────────────────────────────────────────────

export interface ParsedSoal {
  nomorSoal: number;
  teksSoal: string;
  jawabanBenar: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  opsiD: string;
  opsiE: string | null;
}

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportPreviewResult {
  validRows: ParsedSoal[];
  errors: ImportError[];
}

export interface ImportResult {
  imported: number;
  errors: ImportError[];
}

// ─── Response Types ──────────────────────────────────────────────────────────

export interface DuplicateResponse {
  bankSoal: BankSoal;
  message: string;
}

export interface ScheduleExamResponse {
  sessionId: string;
  message: string;
}

// ─── Bank Soal CRUD ──────────────────────────────────────────────────────────

/**
 * Create a new Bank Soal
 * @param dto CreateBankSoalDto
 * @returns Promise<AxiosResponse<BankSoal>>
 */
export function createBankSoal(
  dto: CreateBankSoalDto,
): Promise<AxiosResponse<BankSoal>> {
  return api.post<BankSoal>("/bank-soal", dto);
}

/**
 * Get list of Bank Soal with optional filters and pagination
 * @param query ListBankSoalQueryDto
 * @returns Promise<AxiosResponse<BankSoalListResponse>>
 */
export function getBankSoalList(
  query?: ListBankSoalQueryDto,
): Promise<AxiosResponse<BankSoalListResponse>> {
  return api.get<BankSoalListResponse>("/bank-soal", { params: query });
}

/**
 * Get Bank Soal detail with soal list
 * @param id Bank Soal ID
 * @returns Promise<AxiosResponse<BankSoalDetail>>
 */
export function getBankSoalDetail(
  id: string,
): Promise<AxiosResponse<BankSoalDetail>> {
  return api.get<BankSoalDetail>(`/bank-soal/${id}`);
}

/**
 * Update Bank Soal settings (cannot change mataPelajaranId)
 * @param id Bank Soal ID
 * @param dto UpdateBankSoalDto
 * @returns Promise<AxiosResponse<BankSoal>>
 */
export function updateBankSoal(
  id: string,
  dto: UpdateBankSoalDto,
): Promise<AxiosResponse<BankSoal>> {
  return api.patch<BankSoal>(`/bank-soal/${id}`, dto);
}

/**
 * Delete Bank Soal (cascade deletes all soal)
 * Fails if bank soal is used in any exam session
 * @param id Bank Soal ID
 * @returns Promise<AxiosResponse<void>>
 */
export function deleteBankSoal(id: string): Promise<AxiosResponse<void>> {
  return api.delete(`/bank-soal/${id}`);
}

// ─── Bank Soal Operations ────────────────────────────────────────────────────

/**
 * Duplicate Bank Soal with all its soal
 * @param id Bank Soal ID
 * @returns Promise<AxiosResponse<DuplicateResponse>>
 */
export function duplicateBankSoal(
  id: string,
): Promise<AxiosResponse<DuplicateResponse>> {
  return api.post<DuplicateResponse>(`/bank-soal/${id}/duplicate`);
}

/**
 * Schedule an exam session from Bank Soal
 * Fails if bank soal has 0 soal
 * @param id Bank Soal ID
 * @param dto ScheduleExamDto
 * @returns Promise<AxiosResponse<ScheduleExamResponse>>
 */
export function scheduleExam(
  id: string,
  dto: ScheduleExamDto,
): Promise<AxiosResponse<ScheduleExamResponse>> {
  return api.post<ScheduleExamResponse>(`/bank-soal/${id}/schedule`, dto);
}

// ─── Soal Management ─────────────────────────────────────────────────────────

/**
 * Add a new soal to Bank Soal
 * @param bankSoalId Bank Soal ID
 * @param dto CreateSoalDto
 * @returns Promise<AxiosResponse<Soal>>
 */
export function addSoal(
  bankSoalId: string,
  dto: CreateSoalDto,
): Promise<AxiosResponse<Soal>> {
  return api.post<Soal>(`/bank-soal/${bankSoalId}/soal`, dto);
}

/**
 * Update an existing soal in Bank Soal
 * Fails if bank soal is locked (used in packaged/active/completed session)
 * @param bankSoalId Bank Soal ID
 * @param soalId Soal ID
 * @param dto UpdateSoalDto
 * @returns Promise<AxiosResponse<Soal>>
 */
export function updateSoal(
  bankSoalId: string,
  soalId: string,
  dto: UpdateSoalDto,
): Promise<AxiosResponse<Soal>> {
  return api.patch<Soal>(`/bank-soal/${bankSoalId}/soal/${soalId}`, dto);
}

/**
 * Delete a soal from Bank Soal
 * Fails if bank soal is locked (used in packaged/active/completed session)
 * @param bankSoalId Bank Soal ID
 * @param soalId Soal ID
 * @returns Promise<AxiosResponse<void>>
 */
export function deleteSoal(
  bankSoalId: string,
  soalId: string,
): Promise<AxiosResponse<void>> {
  return api.delete(`/bank-soal/${bankSoalId}/soal/${soalId}`);
}

// ─── Import/Export ───────────────────────────────────────────────────────────

/**
 * Import soal from Excel file with preview
 * Returns parsed rows and validation errors without committing
 * @param bankSoalId Bank Soal ID
 * @param file Excel file
 * @returns Promise<AxiosResponse<ImportPreviewResult>>
 */
export function importSoalPreview(
  bankSoalId: string,
  file: File,
): Promise<AxiosResponse<ImportPreviewResult>> {
  const formData = new FormData();
  formData.append("file", file);
  return api.post<ImportPreviewResult>(
    `/bank-soal/${bankSoalId}/soal/import`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      params: { preview: true },
    },
  );
}

/**
 * Import soal from Excel file (commit)
 * Validates and imports all valid rows
 * @param bankSoalId Bank Soal ID
 * @param file Excel file
 * @returns Promise<AxiosResponse<ImportResult>>
 */
export function importSoal(
  bankSoalId: string,
  file: File,
): Promise<AxiosResponse<ImportResult>> {
  const formData = new FormData();
  formData.append("file", file);
  return api.post<ImportResult>(
    `/bank-soal/${bankSoalId}/soal/import`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
}

/**
 * Download Excel template for soal import
 * Triggers file download with proper filename handling
 * @returns Promise<void>
 */
export async function downloadTemplate(): Promise<void> {
  const response = await api.get("/bank-soal/template", {
    responseType: "blob",
  });

  // Extract filename from Content-Disposition header
  const disposition = response.headers["content-disposition"];
  const filename =
    disposition?.match(/filename="(.+)"/)?.[1] || "template-soal.xlsx";

  // Create blob and trigger download
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ─── Error Messages ──────────────────────────────────────────────────────────

/**
 * Error codes and their Indonesian messages for toast notifications
 */
export const ERROR_MESSAGES: Record<string, string> = {
  NO_ACTIVE_PELAKSANAAN: "Tidak ada pelaksanaan ujian aktif. Hubungi admin.",
  FORBIDDEN_MATA_PELAJARAN: "Anda tidak memiliki akses ke mata pelajaran ini",
  FORBIDDEN_KELAS: "Anda tidak memiliki akses ke kelas ini",
  BANK_SOAL_NOT_FOUND: "Bank soal tidak ditemukan",
  BANK_SOAL_LOCKED:
    "Bank soal tidak dapat diubah karena sudah digunakan dalam sesi ujian yang terkunci",
  BANK_SOAL_DELETE_BLOCKED:
    "Bank soal tidak dapat dihapus karena sudah pernah digunakan dalam sesi ujian",
  SOAL_NOT_FOUND: "Soal tidak ditemukan",
  SOAL_LOCKED:
    "Soal tidak dapat diubah/dihapus karena bank soal sudah digunakan dalam sesi ujian yang terkunci",
  INVALID_DURASI: "Durasi ujian harus antara 5-360 menit",
  INVALID_KKM: "KKM harus antara 0-100",
  INVALID_OPTION_E: "Jawaban benar tidak bisa E jika opsi E tidak diisi",
  INVALID_TEKS_SOAL_LENGTH: "Teks soal harus 1-2000 karakter",
  INVALID_OPSI_LENGTH: "Setiap opsi harus 1-500 karakter",
  BANK_SOAL_EMPTY: "Bank soal belum memiliki soal",
  INVALID_TARGET_KELAS: "Kelas yang dipilih bukan target dari bank soal ini",
};

/**
 * Get user-friendly error message from API error response
 * @param error Axios error object
 * @returns User-friendly error message in Indonesian
 */
export function getErrorMessage(error: unknown): string {
  const axiosError = error as {
    response?: {
      data?: {
        code?: string;
        message?: string;
      };
    };
  };

  const code = axiosError.response?.data?.code;
  if (code && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }

  return (
    axiosError.response?.data?.message ||
    "Terjadi kesalahan. Silakan coba lagi."
  );
}

export default api;
