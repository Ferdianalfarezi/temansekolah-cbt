import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, inArray, sql, SQL, ilike } from "drizzle-orm";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as XLSX from "xlsx";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtQuestion } from "../../drizzle/schema/cbt-question";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { cbtExamSessionQuestion } from "../../drizzle/schema/cbt-exam-session-question";
import { cbtPelaksanaanUjian } from "../../drizzle/schema/cbt-pelaksanaan-ujian";
import { jadwalPelajaran, kelas } from "../../drizzle/schema/lms-tables";
import { AuditLogService } from "../audit-log/audit-log.service";
import {
  CreateQuestionDto,
  UpdateQuestionDto,
  ListQuestionsQueryDto,
  ConfirmImportDto,
} from "./dto";

export interface GuruScope {
  mataPelajaranIds: string[];
  kelasIds: string[];
  tingkatLevels: number[];
}

export interface ParsedQuestion {
  nomorSoal: number;
  teksSoal: string;
  jawabanBenar: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  opsiD: string;
  opsiE?: string;
}

const LOCKED_STATUSES = ["packaged", "active", "completed"];

const VALID_IMAGE_FIELDS = [
  "gambar_soal",
  "gambar_a",
  "gambar_b",
  "gambar_c",
  "gambar_d",
  "gambar_e",
];

@Injectable()
export class QuestionService {
  private readonly logger = new Logger(QuestionService.name);
  private readonly s3Client: S3Client;
  private readonly s3Bucket: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
  ) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>("app.awsRegion", "ap-southeast-1"),
    });
    this.s3Bucket = this.configService.get<string>(
      "app.s3Bucket",
      "cbt-teman-sekolah",
    );
  }

  /**
   * Derive guru scope from jadwal_pelajaran.
   * Returns the set of mata_pelajaran_id + kelas_id + tingkat that this guru teaches.
   */
  async getGuruScope(userId: string, tenantId: string): Promise<GuruScope> {
    const assignments = await this.db
      .select({
        mataPelajaranId: jadwalPelajaran.mataPelajaranId,
        kelasId: jadwalPelajaran.kelasId,
      })
      .from(jadwalPelajaran)
      .where(
        and(
          eq(jadwalPelajaran.guruId, userId),
          eq(jadwalPelajaran.tenantId, tenantId),
        ),
      );

    if (assignments.length === 0) {
      return { mataPelajaranIds: [], kelasIds: [], tingkatLevels: [] };
    }

    const mataPelajaranIds = [
      ...new Set(
        assignments
          .map((a) => a.mataPelajaranId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const kelasIds = [...new Set(assignments.map((a) => a.kelasId))];

    // Derive tingkat levels from the kelas records
    let tingkatLevels: number[] = [];
    if (kelasIds.length > 0) {
      const kelasRecords = await this.db
        .select({ tingkat: kelas.tingkat })
        .from(kelas)
        .where(inArray(kelas.id, kelasIds));
      tingkatLevels = [...new Set(kelasRecords.map((k) => k.tingkat))];
    }

    return { mataPelajaranIds, kelasIds, tingkatLevels };
  }

  /**
   * List questions scoped to guru's assignments within active pelaksanaan_ujian.
   */
  async listQuestions(
    tenantId: string,
    userId: string,
    userRole: string,
    filters: ListQuestionsQueryDto,
  ) {
    const scope = await this.getGuruScope(userId, tenantId);

    // Get active pelaksanaan ujian
    const [activePu] = await this.db
      .select({ id: cbtPelaksanaanUjian.id })
      .from(cbtPelaksanaanUjian)
      .where(
        and(
          eq(cbtPelaksanaanUjian.tenantId, tenantId),
          eq(cbtPelaksanaanUjian.isActive, true),
        ),
      )
      .limit(1);

    if (!activePu) {
      return {
        data: [],
        meta: { page: 1, limit: filters.limit ?? 20, total: 0, totalPages: 0 },
      };
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: SQL[] = [
      eq(cbtQuestion.tenantId, tenantId),
      eq(cbtQuestion.pelaksanaanUjianId, activePu.id),
    ];

    // Scope to guru's mata pelajaran
    if (scope.mataPelajaranIds.length > 0) {
      if (filters.mataPelajaranId) {
        // Verify the guru has access to this mata pelajaran
        if (!scope.mataPelajaranIds.includes(filters.mataPelajaranId)) {
          return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
        }
        conditions.push(
          eq(cbtQuestion.mataPelajaranId, filters.mataPelajaranId),
        );
      } else {
        conditions.push(
          inArray(cbtQuestion.mataPelajaranId, scope.mataPelajaranIds),
        );
      }
    } else {
      // Guru has no assignments — can't see any questions
      return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
    }

    // Filter by tingkat or kelas
    if (filters.tingkat) {
      conditions.push(eq(cbtQuestion.tingkat, filters.tingkat));
    }
    if (filters.kelasId) {
      conditions.push(eq(cbtQuestion.kelasId, filters.kelasId));
    }

    // Search in teksSoal
    if (filters.search) {
      conditions.push(ilike(cbtQuestion.teksSoal, `%${filters.search}%`));
    }

    const whereClause = and(...conditions);

    const [countResult, data] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(cbtQuestion)
        .where(whereClause),
      this.db
        .select()
        .from(cbtQuestion)
        .where(whereClause)
        .orderBy(cbtQuestion.nomorUrut, cbtQuestion.createdAt)
        .limit(limit)
        .offset(offset),
    ]);

    const total = countResult[0]?.count ?? 0;

    // Audit log read access
    if (data.length > 0) {
      await this.auditLogService.logRead(
        { id: userId, type: "staff", role: userRole },
        "cbt_question",
        data.map((q) => q.id),
        tenantId,
        { filters, resultCount: data.length },
      );
    }

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create a new question.
   * Validates guru has scope for the mata_pelajaran + tingkat/kelas combination.
   */
  async createQuestion(
    tenantId: string,
    userId: string,
    userRole: string,
    dto: CreateQuestionDto,
  ) {
    // Validate scope
    const scope = await this.getGuruScope(userId, tenantId);
    this.validateScope(scope, dto.mataPelajaranId, dto.tingkat, dto.kelasId);

    // Validate answer vs options
    this.validateAnswer(dto.jawabanBenar, dto.opsiE);

    // Get active pelaksanaan ujian
    const activePu = await this.getActivePelaksanaanUjian(tenantId);

    // Must have either tingkat or kelasId
    if (!dto.tingkat && !dto.kelasId) {
      throw new BadRequestException("Harus mengisi tingkat atau kelasId");
    }

    const [created] = await this.db
      .insert(cbtQuestion)
      .values({
        tenantId,
        pelaksanaanUjianId: activePu.id,
        mataPelajaranId: dto.mataPelajaranId,
        tingkat: dto.tingkat ?? null,
        kelasId: dto.kelasId ?? null,
        createdBy: userId,
        teksSoal: dto.teksSoal,
        opsiA: dto.opsiA,
        opsiB: dto.opsiB,
        opsiC: dto.opsiC,
        opsiD: dto.opsiD,
        opsiE: dto.opsiE ?? null,
        jawabanBenar: dto.jawabanBenar,
      })
      .returning();

    // Audit log
    await this.auditLogService.logWrite(
      { id: userId, type: "staff", role: userRole },
      "create",
      "cbt_question",
      created.id,
      tenantId,
      null,
      { teksSoal: created.teksSoal, mataPelajaranId: created.mataPelajaranId },
    );

    return created;
  }

  /**
   * Update a question. Rejects if question is locked (in packaged/active/completed session).
   */
  async updateQuestion(
    tenantId: string,
    userId: string,
    userRole: string,
    questionId: string,
    dto: UpdateQuestionDto,
  ) {
    // Find question
    const [question] = await this.db
      .select()
      .from(cbtQuestion)
      .where(
        and(eq(cbtQuestion.id, questionId), eq(cbtQuestion.tenantId, tenantId)),
      )
      .limit(1);

    if (!question) {
      throw new NotFoundException("Soal tidak ditemukan");
    }

    // Validate scope
    const scope = await this.getGuruScope(userId, tenantId);
    this.validateScope(
      scope,
      question.mataPelajaranId,
      question.tingkat,
      question.kelasId,
    );

    // Check lock
    await this.checkQuestionLocked(questionId);

    // Validate answer if changing
    const jawabanBenar = dto.jawabanBenar ?? question.jawabanBenar;
    const opsiE = dto.opsiE !== undefined ? dto.opsiE : question.opsiE;
    this.validateAnswer(jawabanBenar, opsiE);

    // Build update values
    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.teksSoal !== undefined) updateValues.teksSoal = dto.teksSoal;
    if (dto.opsiA !== undefined) updateValues.opsiA = dto.opsiA;
    if (dto.opsiB !== undefined) updateValues.opsiB = dto.opsiB;
    if (dto.opsiC !== undefined) updateValues.opsiC = dto.opsiC;
    if (dto.opsiD !== undefined) updateValues.opsiD = dto.opsiD;
    if (dto.opsiE !== undefined) updateValues.opsiE = dto.opsiE || null;
    if (dto.jawabanBenar !== undefined)
      updateValues.jawabanBenar = dto.jawabanBenar;
    if (dto.tingkat !== undefined) updateValues.tingkat = dto.tingkat;
    if (dto.kelasId !== undefined) updateValues.kelasId = dto.kelasId;
    if (dto.mataPelajaranId !== undefined)
      updateValues.mataPelajaranId = dto.mataPelajaranId;

    const [updated] = await this.db
      .update(cbtQuestion)
      .set(updateValues)
      .where(eq(cbtQuestion.id, questionId))
      .returning();

    // Audit log
    await this.auditLogService.logWrite(
      { id: userId, type: "staff", role: userRole },
      "update",
      "cbt_question",
      questionId,
      tenantId,
      { teksSoal: question.teksSoal },
      { teksSoal: updated.teksSoal },
    );

    return updated;
  }

  /**
   * Delete a question (hard delete). Rejects if question is locked.
   */
  async deleteQuestion(
    tenantId: string,
    userId: string,
    userRole: string,
    questionId: string,
  ) {
    // Find question
    const [question] = await this.db
      .select()
      .from(cbtQuestion)
      .where(
        and(eq(cbtQuestion.id, questionId), eq(cbtQuestion.tenantId, tenantId)),
      )
      .limit(1);

    if (!question) {
      throw new NotFoundException("Soal tidak ditemukan");
    }

    // Validate scope
    const scope = await this.getGuruScope(userId, tenantId);
    this.validateScope(
      scope,
      question.mataPelajaranId,
      question.tingkat,
      question.kelasId,
    );

    // Check lock
    await this.checkQuestionLocked(questionId);

    // Delete
    await this.db.delete(cbtQuestion).where(eq(cbtQuestion.id, questionId));

    // Audit log
    await this.auditLogService.logWrite(
      { id: userId, type: "staff", role: userRole },
      "delete",
      "cbt_question",
      questionId,
      tenantId,
      {
        teksSoal: question.teksSoal,
        mataPelajaranId: question.mataPelajaranId,
      },
      null,
    );

    return { message: "Soal berhasil dihapus" };
  }

  /**
   * Parse an Excel file buffer and return preview data.
   * Expected columns: nomor_soal, teks_soal, jawaban_benar, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e
   */
  parseExcel(file: Buffer): ParsedQuestion[] {
    const workbook = XLSX.read(file, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException("File Excel kosong");
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (rows.length === 0) {
      throw new BadRequestException("File Excel tidak memiliki data");
    }

    const questions: ParsedQuestion[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is header

      const teksSoal = String(row["teks_soal"] ?? "").trim();
      const jawabanBenar = String(row["jawaban_benar"] ?? "")
        .trim()
        .toUpperCase();
      const opsiA = String(row["opsi_a"] ?? "").trim();
      const opsiB = String(row["opsi_b"] ?? "").trim();
      const opsiC = String(row["opsi_c"] ?? "").trim();
      const opsiD = String(row["opsi_d"] ?? "").trim();
      const opsiE = String(row["opsi_e"] ?? "").trim() || undefined;
      const nomorSoal = Number(row["nomor_soal"]) || i + 1;

      // Validation
      if (!teksSoal) {
        errors.push(`Baris ${rowNum}: teks_soal kosong`);
        continue;
      }
      if (!["A", "B", "C", "D", "E"].includes(jawabanBenar)) {
        errors.push(`Baris ${rowNum}: jawaban_benar harus A-E`);
        continue;
      }
      if (!opsiA || !opsiB || !opsiC || !opsiD) {
        errors.push(`Baris ${rowNum}: opsi A-D wajib diisi`);
        continue;
      }
      if (jawabanBenar === "E" && !opsiE) {
        errors.push(`Baris ${rowNum}: jawaban_benar=E tapi opsi_e kosong`);
        continue;
      }

      questions.push({
        nomorSoal,
        teksSoal,
        jawabanBenar,
        opsiA,
        opsiB,
        opsiC,
        opsiD,
        opsiE,
      });
    }

    if (errors.length > 0 && questions.length === 0) {
      throw new BadRequestException({
        message: "Semua baris memiliki error",
        errors,
      });
    }

    return questions;
  }

  /**
   * Confirm import: batch insert validated questions.
   */
  async confirmImport(
    tenantId: string,
    userId: string,
    userRole: string,
    dto: ConfirmImportDto,
  ) {
    // Validate scope
    const scope = await this.getGuruScope(userId, tenantId);
    this.validateScope(scope, dto.mataPelajaranId, dto.tingkat, dto.kelasId);

    // Get active pelaksanaan ujian
    const activePu = await this.getActivePelaksanaanUjian(tenantId);

    // Must have either tingkat or kelasId
    if (!dto.tingkat && !dto.kelasId) {
      throw new BadRequestException("Harus mengisi tingkat atau kelasId");
    }

    // Batch insert
    const values = dto.questions.map((q, idx) => ({
      tenantId,
      pelaksanaanUjianId: activePu.id,
      mataPelajaranId: dto.mataPelajaranId,
      tingkat: dto.tingkat ?? null,
      kelasId: dto.kelasId ?? null,
      createdBy: userId,
      teksSoal: q.teksSoal,
      opsiA: q.opsiA,
      opsiB: q.opsiB,
      opsiC: q.opsiC,
      opsiD: q.opsiD,
      opsiE: q.opsiE ?? null,
      jawabanBenar: q.jawabanBenar,
      nomorUrut: q.nomorUrut ?? idx + 1,
    }));

    const inserted = await this.db
      .insert(cbtQuestion)
      .values(values)
      .returning();

    // Audit log
    await this.auditLogService.logWrite(
      { id: userId, type: "staff", role: userRole },
      "create",
      "cbt_question",
      null,
      tenantId,
      null,
      { count: inserted.length, mataPelajaranId: dto.mataPelajaranId },
      { action: "bulk_import" },
    );

    return {
      message: `${inserted.length} soal berhasil diimpor`,
      count: inserted.length,
    };
  }

  /**
   * Generate Excel template buffer for download.
   */
  generateTemplate(): Buffer {
    const headers = [
      "nomor_soal",
      "teks_soal",
      "jawaban_benar",
      "opsi_a",
      "opsi_b",
      "opsi_c",
      "opsi_d",
      "opsi_e",
    ];

    const exampleRow = [
      1,
      "Berapakah hasil dari 2 + 2?",
      "A",
      "4",
      "5",
      "6",
      "7",
      "",
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 10 },
      { wch: 50 },
      { wch: 15 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Soal");

    return Buffer.from(
      XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
    );
  }

  /**
   * Upload image for a question field to S3.
   */
  async uploadImage(
    tenantId: string,
    userId: string,
    userRole: string,
    questionId: string,
    file: Express.Multer.File,
    field: string,
  ) {
    // Validate field
    if (!VALID_IMAGE_FIELDS.includes(field)) {
      throw new BadRequestException(
        `Field tidak valid. Pilihan: ${VALID_IMAGE_FIELDS.join(", ")}`,
      );
    }

    // Find question
    const [question] = await this.db
      .select()
      .from(cbtQuestion)
      .where(
        and(eq(cbtQuestion.id, questionId), eq(cbtQuestion.tenantId, tenantId)),
      )
      .limit(1);

    if (!question) {
      throw new NotFoundException("Soal tidak ditemukan");
    }

    // Validate scope
    const scope = await this.getGuruScope(userId, tenantId);
    this.validateScope(
      scope,
      question.mataPelajaranId,
      question.tingkat,
      question.kelasId,
    );

    // Check lock
    await this.checkQuestionLocked(questionId);

    // Upload to S3
    const ext = file.originalname.split(".").pop() ?? "png";
    const timestamp = Date.now();
    const key = `cbt-question-images/${tenantId}/${questionId}/${field}_${timestamp}.${ext}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const url = `https://${this.s3Bucket}.s3.amazonaws.com/${key}`;

    // Map field to DB column
    const columnMap: Record<string, string> = {
      gambar_soal: "gambarSoalUrl",
      gambar_a: "gambarAUrl",
      gambar_b: "gambarBUrl",
      gambar_c: "gambarCUrl",
      gambar_d: "gambarDUrl",
      gambar_e: "gambarEUrl",
    };

    const dbColumn = columnMap[field];
    const updatePayload: Record<string, unknown> = {
      [dbColumn]: url,
      updatedAt: new Date(),
    };

    const [updated] = await this.db
      .update(cbtQuestion)
      .set(updatePayload)
      .where(eq(cbtQuestion.id, questionId))
      .returning();

    // Audit log
    await this.auditLogService.logWrite(
      { id: userId, type: "staff", role: userRole },
      "update",
      "cbt_question",
      questionId,
      tenantId,
      { [dbColumn]: (question as any)[dbColumn] },
      { [dbColumn]: url },
      { action: "upload_image", field },
    );

    return { url, field, questionId };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private validateScope(
    scope: GuruScope,
    mataPelajaranId: string,
    tingkat?: number | null,
    kelasId?: string | null,
  ) {
    if (!scope.mataPelajaranIds.includes(mataPelajaranId)) {
      throw new ForbiddenException(
        "Anda tidak memiliki akses ke mata pelajaran ini",
      );
    }

    if (kelasId && !scope.kelasIds.includes(kelasId)) {
      throw new ForbiddenException("Anda tidak memiliki akses ke kelas ini");
    }

    if (tingkat && !scope.tingkatLevels.includes(tingkat)) {
      throw new ForbiddenException("Anda tidak memiliki akses ke tingkat ini");
    }
  }

  private validateAnswer(jawabanBenar: string, opsiE?: string | null) {
    if (jawabanBenar === "E" && !opsiE) {
      throw new BadRequestException(
        "Jawaban benar tidak bisa E jika opsi E tidak diisi",
      );
    }
  }

  private async getActivePelaksanaanUjian(tenantId: string) {
    const [activePu] = await this.db
      .select({ id: cbtPelaksanaanUjian.id })
      .from(cbtPelaksanaanUjian)
      .where(
        and(
          eq(cbtPelaksanaanUjian.tenantId, tenantId),
          eq(cbtPelaksanaanUjian.isActive, true),
        ),
      )
      .limit(1);

    if (!activePu) {
      throw new NotFoundException(
        "Tidak ada pelaksanaan ujian aktif. Hubungi admin.",
      );
    }

    return activePu;
  }

  /**
   * A question is "locked" if it's associated with a cbt_exam_session_question
   * entry where the exam_session status is 'packaged', 'active', or 'completed'.
   */
  private async checkQuestionLocked(questionId: string) {
    const [locked] = await this.db
      .select({ id: cbtExamSessionQuestion.id })
      .from(cbtExamSessionQuestion)
      .innerJoin(
        cbtExamSession,
        eq(cbtExamSessionQuestion.examSessionId, cbtExamSession.id),
      )
      .where(
        and(
          eq(cbtExamSessionQuestion.questionId, questionId),
          sql`${cbtExamSession.status} IN ('packaged', 'active', 'completed')`,
        ),
      )
      .limit(1);

    if (locked) {
      throw new ConflictException(
        "Soal tidak dapat diubah/dihapus karena sudah digunakan dalam sesi ujian yang terkunci (packaged/active/completed)",
      );
    }
  }
}
