/**
 * A single answer option for a question.
 */
export interface QuestionOption {
  label: "A" | "B" | "C" | "D" | "E";
  text: string;
  imageUrl?: string | null;
}

/**
 * Question shape shared between API and frontends.
 * Note: jawabanBenar is excluded when served to Siswa during exam.
 */
export interface Question {
  id: string;
  tenantId: string;
  pelaksanaanUjianId: string;
  mataPelajaranId: string;
  tingkat?: number | null;
  kelasId?: string | null;
  createdBy: string;
  teksSoal: string;
  gambarSoalUrl?: string | null;
  options: QuestionOption[];
  jawabanBenar: "A" | "B" | "C" | "D" | "E";
  nomorUrut: number;
  createdAt: string;
  updatedAt: string;
}
