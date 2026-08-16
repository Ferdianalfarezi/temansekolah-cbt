import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Response } from "express";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import * as ExcelJS from "exceljs";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { AuditLogService } from "../audit-log/audit-log.service";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { cbtPelaksanaanUjian } from "../../drizzle/schema/cbt-pelaksanaan-ujian";
import { cbtExamParticipant } from "../../drizzle/schema/cbt-exam-participant";
import { cbtSiswaAccount } from "../../drizzle/schema/cbt-siswa-account";
import { cbtExamSessionQuestion } from "../../drizzle/schema/cbt-exam-session-question";
import { cbtQuestion } from "../../drizzle/schema/cbt-question";
import { cbtAnswer } from "../../drizzle/schema/cbt-answer";
import { mataPelajaran, kelas, siswa } from "../../drizzle/schema/lms-tables";

/**
 * Export options for result export.
 */
export interface ExportOptions {
  includeDetailedAnswers: boolean;
}

/**
 * Session metadata for export file header.
 */
export interface SessionExportMetadata {
  namaUjian: string;
  tanggalUjian: string;
  durasi: number;
  pelaksanaanUjian: string;
  kelas: string;
  totalPeserta: number;
}

/**
 * Option mapping structure for a single question's randomization.
 */
export interface OptionMapping {
  original: string[]; // ['A', 'B', 'C', 'D'] or ['A', 'B', 'C', 'D', 'E']
  shuffled: string[]; // Shuffled version, e.g., ['C', 'A', 'D', 'B']
}

/**
 * Randomization mapping structure stored in cbt_exam_participant.randomization_mapping JSONB.
 */
export interface RandomizationMapping {
  questionOrder: string[]; // Array of question IDs in display order
  optionMappings: {
    [questionId: string]: OptionMapping;
  };
}

/**
 * Answer key row data for the "Kunci Jawaban" Excel sheet.
 *
 * Used in detailed exports to show the correct answers for each question.
 *
 * _Requirements: 4.3_
 */
export interface AnswerKeyRow {
  nomorSoal: number;
  teksSoal: string; // truncated to 100 chars with "..." suffix
  jawabanBenar: string; // A/B/C/D/E
}

/**
 * Question master data loaded from cbt_exam_session_question joined with cbt_question.
 *
 * Contains the question order and details for a session.
 */
export interface QuestionMasterData {
  questionId: string;
  nomorUrut: number;
  teksSoal: string;
  jawabanBenar: string;
}

/**
 * Raw answer data from cbt_answer table for a single participant.
 */
export interface ParticipantAnswerData {
  questionId: string;
  selectedOption: string | null;
}

/**
 * Participant row data for Excel export.
 *
 * Contains all summary information for a single participant's exam result.
 */
export interface ParticipantRow {
  no: number;
  nisn: string;
  namaSiswa: string;
  kelas: string;
  jawabanBenar: number;
  totalSoal: number;
  nilai: number; // percentage 0-100, 2 decimal places
  waktuSubmit: string | null;
  status: string; // 'submitted' | 'auto_submitted'
  jumlahPelanggaran: number;
  keterangan: string; // 'Dicurigai' if flagged, empty otherwise
  // Internal fields for detailed export (not directly in Excel columns)
  participantId: string;
  randomizationMapping: RandomizationMapping | null;
}

/**
 * Converts a string to a URL-friendly slug by:
 * - Converting to lowercase
 * - Replacing special characters and spaces with hyphens
 * - Removing consecutive hyphens
 * - Trimming leading/trailing hyphens
 *
 * @param text - Input string to convert
 * @returns Slugified string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics (é → e, ü → u)
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/-+/g, "-") // Collapse consecutive hyphens
    .replace(/^-|-$/g, ""); // Trim leading/trailing hyphens
}

/**
 * Formats a Date object as DD-Mon-YYYY string (e.g., "17-Aug-2026").
 *
 * @param date - Date to format
 * @returns Date formatted as DD-Mon-YYYY
 */
export function formatDateReadable(date: Date): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Generates a standardized export filename for exam results.
 *
 * Format: Ujian_{mata-pelajaran}_{kelas}_{tanggal}.xlsx
 * Example: Ujian_Matematika_7A_17-Aug-2026.xlsx
 *
 * @param mapelName - Mata pelajaran name (subject name)
 * @param kelasName - Kelas name (class name)
 * @param date - Date for the filename
 * @returns Formatted filename string
 */
export function generateFilename(
  mapelName: string,
  kelasName: string,
  date: Date,
): string {
  const mapelSlug = slugify(mapelName);
  const kelasSlug = slugify(kelasName);
  const dateStr = formatDateReadable(date);

  return `Ujian_${mapelSlug}_${kelasSlug}_${dateStr}.xlsx`;
}

/**
 * Formats a Date object as YYYYMMDD string.
 *
 * @param date - Date to format
 * @returns Date formatted as YYYYMMDD
 */
export function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Maximum length for Excel sheet names.
 */
const EXCEL_SHEET_NAME_MAX_LENGTH = 31;

/**
 * Regular expression matching characters forbidden in Excel sheet names.
 * Forbidden characters are: : / \ ? * [ ]
 */
const FORBIDDEN_SHEET_CHARS = /[:/\\?*[\]]/g;

/**
 * Generates a valid Excel sheet name from mapel and kelas names.
 *
 * Excel sheet names have these constraints:
 * - Maximum 31 characters
 * - Cannot contain: : / \ ? * [ ]
 * - Must be unique within a workbook
 *
 * The function:
 * 1. Combines mapel and kelas with " - " separator
 * 2. Removes forbidden characters
 * 3. Truncates to 31 characters
 * 4. Handles duplicates by appending " (2)", " (3)", etc.
 *
 * @param mapelName - Mata pelajaran name (subject name)
 * @param kelasName - Kelas name (class name)
 * @param existingNames - Set of already used sheet names for duplicate handling
 * @returns A valid, unique sheet name
 *
 * @example
 * const names = new Set<string>();
 * generateSheetName('Matematika', '7A', names); // 'Matematika - 7A'
 * generateSheetName('Matematika', '7A', names); // 'Matematika - 7A (2)'
 *
 * @example
 * // With forbidden characters
 * generateSheetName('IPA/Fisika', 'Kelas [7]', names); // 'IPAFisika - Kelas 7'
 *
 * @example
 * // Long names get truncated
 * generateSheetName('Pendidikan Agama Islam', 'Kelas 10 MIPA 1', names);
 * // 'Pendidikan Agama Islam - Kela' (31 chars)
 *
 * _Requirements: 5.3, 5.4_
 */
export function generateSheetName(
  mapelName: string,
  kelasName: string,
  existingNames: Set<string>,
): string {
  // Combine mapel and kelas with separator
  const baseName = `${mapelName} - ${kelasName}`;

  // Remove forbidden characters
  const sanitized = baseName.replace(FORBIDDEN_SHEET_CHARS, "");

  // Truncate to max length
  const truncated = sanitized.slice(0, EXCEL_SHEET_NAME_MAX_LENGTH);

  // Check for duplicates and add suffix if needed
  let finalName = truncated;
  let counter = 2;

  while (existingNames.has(finalName)) {
    const suffix = ` (${counter})`;
    // Truncate base name to make room for suffix
    const maxBaseLength = EXCEL_SHEET_NAME_MAX_LENGTH - suffix.length;
    const truncatedBase = sanitized.slice(0, maxBaseLength);
    finalName = `${truncatedBase}${suffix}`;
    counter++;
  }

  // Add to existing names set for tracking
  existingNames.add(finalName);

  return finalName;
}

/**
 * ResultExportService provides Excel export functionality for CBT exam results.
 *
 * Features:
 * - Single session export with optional detailed answers
 * - Bulk export for all sessions in a Pelaksanaan Ujian
 * - Streaming Excel generation for large datasets
 * - Randomization reversal for accurate answer reporting
 */
@Injectable()
export class ResultExportService {
  private readonly logger = new Logger(ResultExportService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Export single exam session results to Excel.
   *
   * Creates an Excel workbook with:
   * - Metadata header rows (1-6) with session info
   * - Column headers row (8)
   * - Participant data rows (9+)
   * - Empty data note if no submissions
   * - When detail=true: Q1...Qn columns and "Kunci Jawaban" sheet
   *
   * Uses streaming workbook writer for memory efficiency with large datasets.
   *
   * @param tenantId - Tenant identifier
   * @param sessionId - Exam session identifier
   * @param options - Export options (includeDetailedAnswers)
   * @param response - Express response for streaming
   *
   * _Requirements: 2.2, 2.3, 2.4, 2.7, 4.1, 4.2, 4.3, 4.4, 8.2, 8.4_
   */
  async exportSession(
    tenantId: string,
    sessionId: string,
    options: ExportOptions,
    response: Response,
  ): Promise<void> {
    this.logger.log(`Starting export for session ${sessionId}`);

    // Load session metadata
    const metadata = await this.getSessionData(tenantId, sessionId);

    // Load participant data
    const participants = await this.buildParticipantRows(
      sessionId,
      options.includeDetailedAnswers,
    );

    // Load question master list if detailed export is requested
    let questions: QuestionMasterData[] = [];
    if (options.includeDetailedAnswers) {
      questions = await this.getQuestionMasterList(sessionId);
    }

    // Get mapel and kelas names for filename
    const sessionInfo = await this.getSessionInfoForFilename(
      tenantId,
      sessionId,
    );
    const filename = generateFilename(
      sessionInfo.mapelName,
      sessionInfo.kelasName,
      sessionInfo.scheduledAt,
    );

    // Set response headers for file download
    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    response.setHeader("Transfer-Encoding", "chunked");

    // Create streaming workbook writer
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: response,
      useStyles: true,
      useSharedStrings: false,
    });

    // Create main "Hasil Ujian" sheet
    const sheet = workbook.addWorksheet("Hasil Ujian");

    // Write metadata header rows (1-6)
    await this.writeMetadataHeader(sheet, metadata);

    // Write column headers row (row 8)
    await this.writeColumnHeaders(
      sheet,
      options.includeDetailedAnswers,
      questions.length,
    );

    // Write participant data rows (row 9+)
    if (participants.length === 0) {
      // Handle empty data case
      await this.writeEmptyDataNote(sheet);
    } else {
      for (const participant of participants) {
        // Load participant answers if detailed export
        let detailedAnswers: Record<string, string> | undefined;
        if (options.includeDetailedAnswers && questions.length > 0) {
          const answers = await this.getParticipantAnswers(
            participant.participantId,
          );
          detailedAnswers = this.buildDetailedAnswerData(
            answers,
            questions,
            participant.randomizationMapping,
          );
        }

        await this.writeParticipantRow(
          sheet,
          participant,
          options.includeDetailedAnswers,
          detailedAnswers,
        );
      }
    }

    // Commit the main sheet
    await sheet.commit();

    // Create "Kunci Jawaban" sheet if detailed export
    if (options.includeDetailedAnswers && questions.length > 0) {
      await this.writeAnswerKeySheet(workbook, questions);
    }

    // Finalize and stream the workbook
    await workbook.commit();

    this.logger.log(`Export completed for session ${sessionId}`);
  }

  /**
   * Export all completed sessions in a Pelaksanaan Ujian to Excel.
   *
   * Creates an Excel workbook with one sheet per completed session:
   * - Sheet names: "{mapel} - {kelas}" truncated to 31 chars
   * - Duplicate handling with " (2)", " (3)" suffix
   * - When detail=true: adds Kunci Jawaban sheets for each session
   *
   * @param tenantId - Tenant identifier
   * @param pelaksanaanUjianId - Pelaksanaan Ujian identifier
   * @param options - Export options (includeDetailedAnswers)
   * @param response - Express response for streaming
   * @returns Number of sessions exported (for audit logging)
   *
   * _Requirements: 5.2, 5.3, 5.4, 5.5, 5.7_
   */
  async exportPelaksanaanUjian(
    tenantId: string,
    pelaksanaanUjianId: string,
    options: ExportOptions,
    response: Response,
  ): Promise<number> {
    this.logger.log(
      `Starting bulk export for Pelaksanaan Ujian ${pelaksanaanUjianId}`,
    );

    // Get all completed sessions in this Pelaksanaan Ujian
    const completedSessions = await this.getCompletedSessionsForPU(
      tenantId,
      pelaksanaanUjianId,
    );

    // No completed sessions - this will be handled by controller as 400 error
    if (completedSessions.length === 0) {
      return 0;
    }

    // Get PU info for filename
    const puInfo = await this.getPelaksanaanUjianInfo(
      tenantId,
      pelaksanaanUjianId,
    );
    const filename = this.generateBulkExportFilename(puInfo.nama, new Date());

    // Set response headers for file download
    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    response.setHeader("Transfer-Encoding", "chunked");

    // Create streaming workbook writer
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: response,
      useStyles: true,
      useSharedStrings: false,
    });

    // Track used sheet names for duplicate handling
    const usedSheetNames = new Set<string>();

    // Create one sheet per session
    for (const sessionInfo of completedSessions) {
      // Generate unique sheet name
      const sheetName = generateSheetName(
        sessionInfo.mapelName,
        sessionInfo.kelasName,
        usedSheetNames,
      );

      // Load session metadata
      const metadata = await this.getSessionData(tenantId, sessionInfo.id);

      // Load participant data
      const participants = await this.buildParticipantRows(
        sessionInfo.id,
        options.includeDetailedAnswers,
      );

      // Load question master list if detailed export is requested
      let questions: QuestionMasterData[] = [];
      if (options.includeDetailedAnswers) {
        questions = await this.getQuestionMasterList(sessionInfo.id);
      }

      // Create sheet for this session
      const sheet = workbook.addWorksheet(sheetName);

      // Write metadata header rows (1-6)
      await this.writeMetadataHeader(sheet, metadata);

      // Write column headers row (row 8)
      await this.writeColumnHeaders(
        sheet,
        options.includeDetailedAnswers,
        questions.length,
      );

      // Write participant data rows (row 9+)
      if (participants.length === 0) {
        await this.writeEmptyDataNote(sheet);
      } else {
        for (const participant of participants) {
          // Load participant answers if detailed export
          let detailedAnswers: Record<string, string> | undefined;
          if (options.includeDetailedAnswers && questions.length > 0) {
            const answers = await this.getParticipantAnswers(
              participant.participantId,
            );
            detailedAnswers = this.buildDetailedAnswerData(
              answers,
              questions,
              participant.randomizationMapping,
            );
          }

          await this.writeParticipantRow(
            sheet,
            participant,
            options.includeDetailedAnswers,
            detailedAnswers,
          );
        }
      }

      // Commit this session's sheet
      await sheet.commit();

      // Create "Kunci Jawaban" sheet if detailed export
      if (options.includeDetailedAnswers && questions.length > 0) {
        // Generate unique name for answer key sheet
        const answerKeySheetName = generateSheetName(
          `Kunci_${sessionInfo.mapelName}`,
          sessionInfo.kelasName,
          usedSheetNames,
        );
        await this.writeAnswerKeySheetWithName(
          workbook,
          questions,
          answerKeySheetName,
        );
      }
    }

    // Finalize and stream the workbook
    await workbook.commit();

    this.logger.log(
      `Bulk export completed for Pelaksanaan Ujian ${pelaksanaanUjianId}, exported ${completedSessions.length} sessions`,
    );

    return completedSessions.length;
  }

  /**
   * Gets all completed exam sessions for a Pelaksanaan Ujian.
   *
   * @param tenantId - Tenant identifier
   * @param pelaksanaanUjianId - Pelaksanaan Ujian identifier
   * @returns Array of completed session info with mapel and kelas names
   *
   * _Requirements: 5.2_
   */
  private async getCompletedSessionsForPU(
    tenantId: string,
    pelaksanaanUjianId: string,
  ): Promise<
    Array<{
      id: string;
      mapelName: string;
      kelasName: string;
    }>
  > {
    const sessions = await this.db
      .select({
        id: cbtExamSession.id,
        mapelName: mataPelajaran.nama,
        kelasName: kelas.nama,
      })
      .from(cbtExamSession)
      .innerJoin(
        mataPelajaran,
        eq(cbtExamSession.mataPelajaranId, mataPelajaran.id),
      )
      .innerJoin(kelas, eq(cbtExamSession.kelasId, kelas.id))
      .where(
        and(
          eq(cbtExamSession.tenantId, tenantId),
          eq(cbtExamSession.pelaksanaanUjianId, pelaksanaanUjianId),
          eq(cbtExamSession.status, "completed"),
        ),
      )
      .orderBy(asc(mataPelajaran.nama), asc(kelas.nama));

    return sessions;
  }

  /**
   * Gets Pelaksanaan Ujian info for filename generation.
   *
   * @param tenantId - Tenant identifier
   * @param pelaksanaanUjianId - Pelaksanaan Ujian identifier
   * @returns PU info with nama
   * @throws NotFoundException if PU not found
   *
   * _Requirements: 5.6_
   */
  async getPelaksanaanUjianInfo(
    tenantId: string,
    pelaksanaanUjianId: string,
  ): Promise<{ id: string; nama: string }> {
    const [pu] = await this.db
      .select({
        id: cbtPelaksanaanUjian.id,
        nama: cbtPelaksanaanUjian.nama,
      })
      .from(cbtPelaksanaanUjian)
      .where(
        and(
          eq(cbtPelaksanaanUjian.id, pelaksanaanUjianId),
          eq(cbtPelaksanaanUjian.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!pu) {
      throw new NotFoundException("Pelaksanaan ujian tidak ditemukan");
    }

    return pu;
  }

  /**
   * Checks if a Pelaksanaan Ujian has any completed sessions.
   *
   * Used by controller to return 400 error before streaming begins.
   *
   * @param tenantId - Tenant identifier
   * @param pelaksanaanUjianId - Pelaksanaan Ujian identifier
   * @returns true if at least one completed session exists
   *
   * _Requirements: 5.5_
   */
  async hasCompletedSessions(
    tenantId: string,
    pelaksanaanUjianId: string,
  ): Promise<boolean> {
    const [result] = await this.db
      .select({ count: count() })
      .from(cbtExamSession)
      .where(
        and(
          eq(cbtExamSession.tenantId, tenantId),
          eq(cbtExamSession.pelaksanaanUjianId, pelaksanaanUjianId),
          eq(cbtExamSession.status, "completed"),
        ),
      )
      .limit(1);

    return (result?.count ?? 0) > 0;
  }

  /**
   * Generates filename for bulk export.
   *
   * Format: Ujian_{pelaksanaan-ujian-nama}_{tanggal-export}.xlsx
   * Example: Ujian_UTS-Semester-1_17-Aug-2026.xlsx
   *
   * @param puNama - Pelaksanaan Ujian name
   * @param exportDate - Date of export
   * @returns Formatted filename
   *
   * _Requirements: 5.6_
   */
  private generateBulkExportFilename(puNama: string, exportDate: Date): string {
    const puSlug = slugify(puNama);
    const dateStr = formatDateReadable(exportDate);
    return `Ujian_${puSlug}_${dateStr}.xlsx`;
  }

  /**
   * Writes the answer key sheet with a custom name.
   * Used for bulk exports where each session needs its own answer key sheet.
   *
   * @param workbook - ExcelJS workbook writer
   * @param questions - Question master data
   * @param sheetName - Custom sheet name
   *
   * _Requirements: 5.7_
   */
  private async writeAnswerKeySheetWithName(
    workbook: ExcelJS.stream.xlsx.WorkbookWriter,
    questions: QuestionMasterData[],
    sheetName: string,
  ): Promise<void> {
    const sheet = workbook.addWorksheet(sheetName);

    // Write column headers (row 1)
    const headerRow = sheet.getRow(1);
    const headers = ["Nomor Soal", "Teks Soal", "Jawaban Benar"];

    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true };
    });

    // Set column widths
    sheet.getColumn(1).width = 12; // Nomor Soal
    sheet.getColumn(2).width = 80; // Teks Soal (truncated to 100 chars)
    sheet.getColumn(3).width = 15; // Jawaban Benar

    headerRow.commit();

    // Build answer key rows
    const answerKeyRows = this.buildAnswerKeyRows(questions);

    // Write answer key data rows (row 2+)
    answerKeyRows.forEach((answerKey, index) => {
      const row = sheet.getRow(2 + index);
      row.getCell(1).value = answerKey.nomorSoal;
      row.getCell(2).value = answerKey.teksSoal;
      row.getCell(3).value = answerKey.jawabanBenar;
      row.commit();
    });

    await sheet.commit();
  }

  /**
   * Loads session metadata for export file header.
   *
   * Joins cbt_exam_session with mata_pelajaran, kelas, and cbt_pelaksanaan_ujian
   * to gather all required metadata for the export header section.
   *
   * @param tenantId - Tenant identifier for access validation
   * @param sessionId - Exam session identifier
   * @returns SessionExportMetadata with all header information
   * @throws NotFoundException if session not found or doesn't belong to tenant
   *
   * _Requirements: 2.4_
   */
  async getSessionData(
    tenantId: string,
    sessionId: string,
  ): Promise<SessionExportMetadata> {
    // Query session with joins to get all metadata
    const sessionData = await this.db
      .select({
        namaUjian: mataPelajaran.nama,
        scheduledAt: cbtExamSession.scheduledAt,
        durasi: cbtExamSession.durationMinutes,
        pelaksanaanUjian: cbtPelaksanaanUjian.nama,
        kelas: kelas.nama,
      })
      .from(cbtExamSession)
      .innerJoin(
        mataPelajaran,
        eq(cbtExamSession.mataPelajaranId, mataPelajaran.id),
      )
      .innerJoin(kelas, eq(cbtExamSession.kelasId, kelas.id))
      .innerJoin(
        cbtPelaksanaanUjian,
        eq(cbtExamSession.pelaksanaanUjianId, cbtPelaksanaanUjian.id),
      )
      .where(
        and(
          eq(cbtExamSession.id, sessionId),
          eq(cbtExamSession.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (sessionData.length === 0) {
      throw new NotFoundException("Sesi ujian tidak ditemukan");
    }

    const session = sessionData[0];

    // Count total participants (all statuses, not just submitted)
    // This represents total peserta assigned to the session
    const participantCount = await this.db
      .select({ count: count() })
      .from(cbtExamParticipant)
      .where(eq(cbtExamParticipant.examSessionId, sessionId));

    const totalPeserta = participantCount[0]?.count ?? 0;

    // Format the scheduled date in Indonesian format
    // Format: "15 Januari 2025 08:00 WIB"
    const tanggalUjian = this.formatTanggalUjian(session.scheduledAt);

    return {
      namaUjian: session.namaUjian,
      tanggalUjian,
      durasi: session.durasi,
      pelaksanaanUjian: session.pelaksanaanUjian,
      kelas: session.kelas,
      totalPeserta,
    };
  }

  /**
   * Formats a Date object to Indonesian date format for export header.
   *
   * Format: "15 Januari 2025 08:00 WIB"
   *
   * @param date - Date to format
   * @returns Formatted date string in Indonesian
   */
  private formatTanggalUjian(date: Date): string {
    const months = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];

    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${day} ${month} ${year} ${hours}:${minutes} WIB`;
  }

  /**
   * Builds participant rows for export from a given exam session.
   *
   * Queries cbt_exam_participant joined with cbt_siswa_account, siswa, and kelas.
   * Filters by status IN ('submitted', 'auto_submitted') and sorts by nama_siswa
   * in ascending alphabetical order (locale-sensitive using Indonesian collation).
   *
   * @param sessionId - Exam session identifier
   * @param _includeAnswers - Reserved for future use (detailed answer loading)
   * @returns Array of ParticipantRow objects sorted by student name
   *
   * _Requirements: 2.3, 2.5, 2.6_
   */
  async buildParticipantRows(
    sessionId: string,
    _includeAnswers: boolean,
  ): Promise<ParticipantRow[]> {
    // Query participants with joins to siswa account, siswa, and kelas
    const participantData = await this.db
      .select({
        participantId: cbtExamParticipant.id,
        nisn: cbtSiswaAccount.nisn,
        namaSiswa: siswa.nama,
        kelas: kelas.nama,
        scoreCorrect: cbtExamParticipant.scoreCorrect,
        scoreTotal: cbtExamParticipant.scoreTotal,
        submittedAt: cbtExamParticipant.submittedAt,
        status: cbtExamParticipant.status,
        violationCount: cbtExamParticipant.violationCount,
        isFlaggedCheating: cbtExamParticipant.isFlaggedCheating,
        randomizationMapping: cbtExamParticipant.randomizationMapping,
      })
      .from(cbtExamParticipant)
      .innerJoin(
        cbtSiswaAccount,
        eq(cbtExamParticipant.siswaAccountId, cbtSiswaAccount.id),
      )
      .innerJoin(siswa, eq(cbtSiswaAccount.siswaId, siswa.id))
      .innerJoin(kelas, eq(siswa.kelasId, kelas.id))
      .where(
        and(
          eq(cbtExamParticipant.examSessionId, sessionId),
          inArray(cbtExamParticipant.status, ["submitted", "auto_submitted"]),
        ),
      );

    // Sort by nama_siswa ascending using Indonesian locale
    const sortedData = participantData.sort((a, b) =>
      a.namaSiswa.localeCompare(b.namaSiswa, "id", { sensitivity: "base" }),
    );

    // Map to ParticipantRow interface with row numbers
    return sortedData.map((row, index) => {
      // Calculate percentage: round((scoreCorrect / scoreTotal) * 100, 2)
      const nilai = this.calculatePercentage(row.scoreCorrect, row.scoreTotal);

      // Format waktu submit in Indonesian format (or null if not available)
      const waktuSubmit = row.submittedAt
        ? this.formatTanggalUjian(row.submittedAt)
        : null;

      return {
        no: index + 1,
        nisn: row.nisn,
        namaSiswa: row.namaSiswa,
        kelas: row.kelas,
        jawabanBenar: row.scoreCorrect ?? 0,
        totalSoal: row.scoreTotal ?? 0,
        nilai,
        waktuSubmit,
        status: row.status,
        jumlahPelanggaran: row.violationCount,
        keterangan: row.isFlaggedCheating ? "Dicurigai" : "",
        participantId: row.participantId,
        randomizationMapping:
          row.randomizationMapping as RandomizationMapping | null,
      };
    });
  }

  /**
   * Calculates the percentage score rounded to 2 decimal places.
   *
   * Formula: round((scoreCorrect / scoreTotal) * 100, 2)
   *
   * @param scoreCorrect - Number of correct answers (can be null)
   * @param scoreTotal - Total number of questions (can be null)
   * @returns Percentage value between 0-100 with 2 decimal places, or 0 if inputs are invalid
   *
   * _Requirements: 2.5_
   */
  calculatePercentage(
    scoreCorrect: number | null,
    scoreTotal: number | null,
  ): number {
    // Handle null/undefined or zero total
    if (
      scoreCorrect === null ||
      scoreCorrect === undefined ||
      scoreTotal === null ||
      scoreTotal === undefined ||
      scoreTotal === 0
    ) {
      return 0;
    }

    // Calculate percentage and round to 2 decimal places
    const percentage = (scoreCorrect / scoreTotal) * 100;
    return Math.round(percentage * 100) / 100;
  }

  /**
   * Reverse-maps a student's selected answer back to the original option letter
   * using the randomization mapping stored during exam start.
   *
   * Algorithm:
   * 1. Get the student's selected option (e.g., 'C')
   * 2. Find its index in the `shuffled` array (e.g., index 0)
   * 3. Return the option at the same index in `original` array (e.g., 'A')
   *
   * @param mapping - The randomization mapping object (or null/undefined if no randomization)
   * @param selectedOption - The option the student selected (A/B/C/D/E or null/undefined)
   * @param questionId - The question ID to look up in optionMappings
   * @returns The original option letter, or "-" if unanswered, or identity if no mapping
   *
   * @example
   * // Given mapping for Q1: original=['A','B','C','D','E'], shuffled=['D','B','A','E','C']
   * // If student selected 'C' (index 4 in shuffled), returns 'C' at index 4 in original = 'E'
   * reverseRandomizationMapping(mapping, 'C', 'q1') // returns 'E'
   *
   * _Requirements: 4.6_
   */
  reverseRandomizationMapping(
    mapping: RandomizationMapping | null | undefined,
    selectedOption: string | null | undefined,
    questionId: string,
  ): string {
    // Handle null/undefined answers - return "-" for unanswered
    if (selectedOption === null || selectedOption === undefined) {
      return "-";
    }

    // Handle missing mapping - return identity (the selected option as-is)
    if (!mapping || !mapping.optionMappings) {
      return selectedOption;
    }

    const optionMapping = mapping.optionMappings[questionId];

    // Handle missing mapping for this specific question - identity return
    if (!optionMapping || !optionMapping.shuffled || !optionMapping.original) {
      return selectedOption;
    }

    // Find the index of the selected option in the shuffled array
    const shuffledIndex = optionMapping.shuffled.indexOf(selectedOption);

    // If the selected option is not found in shuffled array, return identity
    // This handles edge cases like invalid input
    if (shuffledIndex === -1) {
      return selectedOption;
    }

    // Validate the index is within bounds of original array
    if (shuffledIndex >= optionMapping.original.length) {
      return selectedOption;
    }

    // Return the original option at the same index
    return optionMapping.original[shuffledIndex];
  }

  /**
   * Loads the master question list for an exam session.
   *
   * Queries cbt_exam_session_question joined with cbt_question to get:
   * - Question order (nomor_urut) as stored at packaging time
   * - Question text and correct answer for the "Kunci Jawaban" sheet
   *
   * The question order returned is the MASTER order, not the randomized per-student order.
   * This is used for Q1, Q2... column headers in detailed exports.
   *
   * @param sessionId - Exam session identifier
   * @returns Array of QuestionMasterData sorted by nomor_urut ascending
   *
   * _Requirements: 4.5_
   */
  async getQuestionMasterList(
    sessionId: string,
  ): Promise<QuestionMasterData[]> {
    const questions = await this.db
      .select({
        questionId: cbtExamSessionQuestion.questionId,
        nomorUrut: cbtExamSessionQuestion.nomorUrut,
        teksSoal: cbtQuestion.teksSoal,
        jawabanBenar: cbtQuestion.jawabanBenar,
      })
      .from(cbtExamSessionQuestion)
      .innerJoin(
        cbtQuestion,
        eq(cbtExamSessionQuestion.questionId, cbtQuestion.id),
      )
      .where(eq(cbtExamSessionQuestion.examSessionId, sessionId))
      .orderBy(asc(cbtExamSessionQuestion.nomorUrut));

    return questions;
  }

  /**
   * Loads answer data for a specific participant.
   *
   * Queries cbt_answer table to get all answers submitted by the participant.
   *
   * @param participantId - Participant identifier
   * @returns Array of ParticipantAnswerData with question IDs and selected options
   *
   * _Requirements: 4.2_
   */
  async getParticipantAnswers(
    participantId: string,
  ): Promise<ParticipantAnswerData[]> {
    const answers = await this.db
      .select({
        questionId: cbtAnswer.questionId,
        selectedOption: cbtAnswer.selectedOption,
      })
      .from(cbtAnswer)
      .where(eq(cbtAnswer.participantId, participantId));

    return answers;
  }

  /**
   * Builds answer key rows for the "Kunci Jawaban" sheet.
   *
   * Takes the question master list and formats it for the Excel sheet.
   * Teks soal is truncated to 100 characters with "..." suffix if longer.
   *
   * @param questions - Question master data from getQuestionMasterList
   * @returns Array of AnswerKeyRow for the "Kunci Jawaban" sheet
   *
   * _Requirements: 4.3_
   */
  buildAnswerKeyRows(questions: QuestionMasterData[]): AnswerKeyRow[] {
    return questions.map((q) => ({
      nomorSoal: q.nomorUrut,
      teksSoal: this.truncateText(q.teksSoal, 100),
      jawabanBenar: q.jawabanBenar,
    }));
  }

  /**
   * Builds detailed answer data for a single participant.
   *
   * Maps the participant's raw answers to the question master order,
   * applying randomization reversal to show the original option letters.
   *
   * @param answers - Raw answers from getParticipantAnswers
   * @param questions - Question master list from getQuestionMasterList
   * @param randomizationMapping - Participant's randomization mapping (or null)
   * @returns Record mapping Q column names (Q1, Q2, etc.) to original answers (A/B/C/D/E/-)
   *
   * _Requirements: 4.2, 4.5, 4.6_
   */
  buildDetailedAnswerData(
    answers: ParticipantAnswerData[],
    questions: QuestionMasterData[],
    randomizationMapping: RandomizationMapping | null,
  ): Record<string, string> {
    // Create a map of questionId -> selectedOption for quick lookup
    const answerMap = new Map<string, string | null>();
    for (const answer of answers) {
      answerMap.set(answer.questionId, answer.selectedOption);
    }

    // Build the Q1, Q2, etc. columns based on question master order
    const result: Record<string, string> = {};

    for (const question of questions) {
      const columnName = `Q${question.nomorUrut}`;
      const rawAnswer = answerMap.get(question.questionId) ?? null;

      // Apply randomization reversal to get original answer
      const originalAnswer = this.reverseRandomizationMapping(
        randomizationMapping,
        rawAnswer,
        question.questionId,
      );

      result[columnName] = originalAnswer;
    }

    return result;
  }

  /**
   * Truncates text to a maximum length with "..." suffix.
   *
   * @param text - Text to truncate
   * @param maxLength - Maximum length including "..." suffix
   * @returns Truncated text with "..." suffix if longer than maxLength
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    // Reserve 3 characters for "..."
    return text.slice(0, maxLength - 3) + "...";
  }

  /**
   * Session info interface for filename generation.
   */
  private async getSessionInfoForFilename(
    tenantId: string,
    sessionId: string,
  ): Promise<{ mapelName: string; kelasName: string; scheduledAt: Date }> {
    const sessionData = await this.db
      .select({
        mapelName: mataPelajaran.nama,
        kelasName: kelas.nama,
        scheduledAt: cbtExamSession.scheduledAt,
      })
      .from(cbtExamSession)
      .innerJoin(
        mataPelajaran,
        eq(cbtExamSession.mataPelajaranId, mataPelajaran.id),
      )
      .innerJoin(kelas, eq(cbtExamSession.kelasId, kelas.id))
      .where(
        and(
          eq(cbtExamSession.id, sessionId),
          eq(cbtExamSession.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (sessionData.length === 0) {
      throw new NotFoundException("Sesi ujian tidak ditemukan");
    }

    return sessionData[0];
  }

  /**
   * Writes metadata header rows (1-6) to the Excel sheet.
   *
   * Format:
   * - Row 1: Nama Ujian: {value}
   * - Row 2: Tanggal: {value}
   * - Row 3: Durasi: {value} menit
   * - Row 4: Pelaksanaan: {value}
   * - Row 5: Kelas: {value}
   * - Row 6: Total Peserta: {value}
   *
   * @param sheet - ExcelJS worksheet to write to
   * @param metadata - Session metadata
   */
  private async writeMetadataHeader(
    sheet: ExcelJS.Worksheet,
    metadata: SessionExportMetadata,
  ): Promise<void> {
    // Row 1: Nama Ujian
    const row1 = sheet.getRow(1);
    row1.getCell(1).value = "Nama Ujian";
    row1.getCell(2).value = metadata.namaUjian;
    row1.commit();

    // Row 2: Tanggal
    const row2 = sheet.getRow(2);
    row2.getCell(1).value = "Tanggal";
    row2.getCell(2).value = metadata.tanggalUjian;
    row2.commit();

    // Row 3: Durasi
    const row3 = sheet.getRow(3);
    row3.getCell(1).value = "Durasi";
    row3.getCell(2).value = `${metadata.durasi} menit`;
    row3.commit();

    // Row 4: Pelaksanaan
    const row4 = sheet.getRow(4);
    row4.getCell(1).value = "Pelaksanaan";
    row4.getCell(2).value = metadata.pelaksanaanUjian;
    row4.commit();

    // Row 5: Kelas
    const row5 = sheet.getRow(5);
    row5.getCell(1).value = "Kelas";
    row5.getCell(2).value = metadata.kelas;
    row5.commit();

    // Row 6: Total Peserta
    const row6 = sheet.getRow(6);
    row6.getCell(1).value = "Total Peserta";
    row6.getCell(2).value = metadata.totalPeserta;
    row6.commit();

    // Row 7 is empty (separator)
    const row7 = sheet.getRow(7);
    row7.commit();
  }

  /**
   * Writes column headers row (row 8) to the Excel sheet.
   *
   * Summary columns:
   * No | NISN | Nama Siswa | Kelas | Benar | Total | Nilai | Waktu Submit | Status | Pelanggaran | Keterangan
   *
   * When includeDetailedAnswers=true, adds Q1, Q2, ..., Qn columns after Keterangan.
   *
   * @param sheet - ExcelJS worksheet to write to
   * @param includeDetailedAnswers - Whether to add Q columns for detailed export
   * @param questionCount - Number of questions (for Q column headers)
   *
   * _Requirements: 4.1, 4.2_
   */
  private async writeColumnHeaders(
    sheet: ExcelJS.Worksheet,
    includeDetailedAnswers: boolean,
    questionCount: number = 0,
  ): Promise<void> {
    const headerRow = sheet.getRow(8);

    // Summary column headers
    const headers = [
      "No",
      "NISN",
      "Nama Siswa",
      "Kelas",
      "Benar",
      "Total",
      "Nilai",
      "Waktu Submit",
      "Status",
      "Pelanggaran",
      "Keterangan",
    ];

    // Add Q1, Q2, ..., Qn headers if detailed export
    if (includeDetailedAnswers && questionCount > 0) {
      for (let i = 1; i <= questionCount; i++) {
        headers.push(`Q${i}`);
      }
    }

    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true };
    });

    // Set column widths for better readability
    sheet.getColumn(1).width = 5; // No
    sheet.getColumn(2).width = 15; // NISN
    sheet.getColumn(3).width = 30; // Nama Siswa
    sheet.getColumn(4).width = 10; // Kelas
    sheet.getColumn(5).width = 8; // Benar
    sheet.getColumn(6).width = 8; // Total
    sheet.getColumn(7).width = 10; // Nilai
    sheet.getColumn(8).width = 25; // Waktu Submit
    sheet.getColumn(9).width = 15; // Status
    sheet.getColumn(10).width = 12; // Pelanggaran
    sheet.getColumn(11).width = 15; // Keterangan

    // Set width for Q columns (narrow since they only contain A/B/C/D/E/-)
    if (includeDetailedAnswers && questionCount > 0) {
      for (let i = 0; i < questionCount; i++) {
        sheet.getColumn(12 + i).width = 5;
      }
    }

    headerRow.commit();
  }

  /**
   * Writes a single participant data row to the Excel sheet.
   *
   * When includeDetailedAnswers=true, also writes Q1, Q2, ..., Qn columns
   * with the participant's answers (original option letters after randomization reversal).
   *
   * @param sheet - ExcelJS worksheet to write to
   * @param participant - Participant row data
   * @param includeDetailedAnswers - Whether to add Q columns
   * @param detailedAnswers - Map of Q column names to answer values (e.g., { Q1: 'A', Q2: 'B', ... })
   *
   * _Requirements: 4.1, 4.2_
   */
  private async writeParticipantRow(
    sheet: ExcelJS.Worksheet,
    participant: ParticipantRow,
    includeDetailedAnswers: boolean,
    detailedAnswers?: Record<string, string>,
  ): Promise<void> {
    // Participant rows start at row 9
    const rowNumber = 8 + participant.no;
    const row = sheet.getRow(rowNumber);

    // Summary columns
    row.getCell(1).value = participant.no;
    row.getCell(2).value = participant.nisn;
    row.getCell(3).value = participant.namaSiswa;
    row.getCell(4).value = participant.kelas;
    row.getCell(5).value = participant.jawabanBenar;
    row.getCell(6).value = participant.totalSoal;
    row.getCell(7).value = participant.nilai;
    row.getCell(8).value = participant.waktuSubmit ?? "-";
    row.getCell(9).value = participant.status;
    row.getCell(10).value = participant.jumlahPelanggaran;
    row.getCell(11).value = participant.keterangan;

    // Add Q columns if detailed export
    if (includeDetailedAnswers && detailedAnswers) {
      // Get Q column names sorted by number (Q1, Q2, Q3, ...)
      const qColumnNames = Object.keys(detailedAnswers).sort((a, b) => {
        const numA = parseInt(a.replace("Q", ""), 10);
        const numB = parseInt(b.replace("Q", ""), 10);
        return numA - numB;
      });

      qColumnNames.forEach((qName, index) => {
        // Q columns start at column 12 (after Keterangan at column 11)
        row.getCell(12 + index).value = detailedAnswers[qName];
      });
    }

    row.commit();
  }

  /**
   * Writes the "Kunci Jawaban" sheet with answer key data.
   *
   * The sheet contains:
   * - Row 1: Column headers (Nomor Soal, Teks Soal, Jawaban Benar)
   * - Row 2+: Answer key data for each question
   *
   * Teks Soal is truncated to 100 characters with "..." suffix if longer.
   *
   * @param workbook - ExcelJS workbook writer
   * @param questions - Question master data
   *
   * _Requirements: 4.3, 4.4_
   */
  private async writeAnswerKeySheet(
    workbook: ExcelJS.stream.xlsx.WorkbookWriter,
    questions: QuestionMasterData[],
  ): Promise<void> {
    const sheet = workbook.addWorksheet("Kunci Jawaban");

    // Write column headers (row 1)
    const headerRow = sheet.getRow(1);
    const headers = ["Nomor Soal", "Teks Soal", "Jawaban Benar"];

    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true };
    });

    // Set column widths
    sheet.getColumn(1).width = 12; // Nomor Soal
    sheet.getColumn(2).width = 80; // Teks Soal (truncated to 100 chars)
    sheet.getColumn(3).width = 15; // Jawaban Benar

    headerRow.commit();

    // Build answer key rows
    const answerKeyRows = this.buildAnswerKeyRows(questions);

    // Write answer key data rows (row 2+)
    answerKeyRows.forEach((answerKey, index) => {
      const row = sheet.getRow(2 + index);
      row.getCell(1).value = answerKey.nomorSoal;
      row.getCell(2).value = answerKey.teksSoal;
      row.getCell(3).value = answerKey.jawabanBenar;
      row.commit();
    });

    await sheet.commit();
  }

  /**
   * Writes the "Tidak ada data submission" note for empty exports.
   *
   * This is written to cell A10 when there are no submitted participants.
   *
   * @param sheet - ExcelJS worksheet to write to
   */
  private async writeEmptyDataNote(sheet: ExcelJS.Worksheet): Promise<void> {
    const row = sheet.getRow(10);
    const cell = row.getCell(1);
    cell.value = "Tidak ada data submission";
    cell.font = { italic: true };
    row.commit();
  }
}
