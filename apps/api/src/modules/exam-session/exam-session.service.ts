import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, sql, SQL } from "drizzle-orm";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { cbtExamSessionQuestion } from "../../drizzle/schema/cbt-exam-session-question";
import { cbtExamParticipant } from "../../drizzle/schema/cbt-exam-participant";
import { cbtPelaksanaanUjian } from "../../drizzle/schema/cbt-pelaksanaan-ujian";
import {
  CreateExamSessionDto,
  BatchCreateExamSessionDto,
  UpdateExamSessionDto,
  ListSessionsQueryDto,
} from "./dto";

@Injectable()
export class ExamSessionService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  /**
   * Create a single exam session in draft status.
   * Validates: scheduled_at >= now + 60min, duration 5-360, within active pelaksanaan_ujian.
   */
  async create(tenantId: string, dto: CreateExamSessionDto) {
    await this.validateScheduledAt(dto.scheduledAt);
    await this.validatePelaksanaanUjian(tenantId, dto.pelaksanaanUjianId);

    const [created] = await this.db
      .insert(cbtExamSession)
      .values({
        tenantId,
        pelaksanaanUjianId: dto.pelaksanaanUjianId,
        mataPelajaranId: dto.mataPelajaranId,
        kelasId: dto.kelasId,
        proctorId: dto.proctorId,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes,
        randomizeQuestions: dto.randomizeQuestions ?? false,
        randomizeOptions: dto.randomizeOptions ?? false,
        antiCheatLevel: dto.antiCheatLevel ?? "standard",
        resultDetailLevel: dto.resultDetailLevel ?? "score_only",
        status: "draft",
      })
      .returning();

    return created;
  }

  /**
   * Batch create exam sessions for multiple kelas with identical config.
   * One session per kelasId.
   */
  async batchCreate(tenantId: string, dto: BatchCreateExamSessionDto) {
    await this.validateScheduledAt(dto.scheduledAt);
    await this.validatePelaksanaanUjian(tenantId, dto.pelaksanaanUjianId);

    const values = dto.kelasIds.map((kelasId) => ({
      tenantId,
      pelaksanaanUjianId: dto.pelaksanaanUjianId,
      mataPelajaranId: dto.mataPelajaranId,
      kelasId,
      proctorId: dto.proctorId,
      scheduledAt: new Date(dto.scheduledAt),
      durationMinutes: dto.durationMinutes,
      randomizeQuestions: dto.randomizeQuestions ?? false,
      randomizeOptions: dto.randomizeOptions ?? false,
      antiCheatLevel: (dto.antiCheatLevel ?? "standard") as
        "standard" | "relaxed",
      resultDetailLevel: (dto.resultDetailLevel ?? "score_only") as
        "score_only" | "score_with_indicator" | "full_detail",
      status: "draft" as const,
    }));

    const created = await this.db
      .insert(cbtExamSession)
      .values(values)
      .returning();

    return {
      message: `${created.length} sesi ujian berhasil dibuat`,
      count: created.length,
      sessions: created,
    };
  }

  /**
   * Update a draft exam session only.
   */
  async update(tenantId: string, sessionId: string, dto: UpdateExamSessionDto) {
    const session = await this.getSessionOrFail(tenantId, sessionId);

    if (session.status !== "draft") {
      throw new ConflictException(
        "Hanya sesi ujian berstatus draft yang dapat diubah",
      );
    }

    // Validate scheduled_at if being updated
    if (dto.scheduledAt) {
      await this.validateScheduledAt(dto.scheduledAt);
    }

    // Validate pelaksanaan ujian if being changed
    if (dto.pelaksanaanUjianId) {
      await this.validatePelaksanaanUjian(tenantId, dto.pelaksanaanUjianId);
    }

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.pelaksanaanUjianId !== undefined)
      updateValues.pelaksanaanUjianId = dto.pelaksanaanUjianId;
    if (dto.mataPelajaranId !== undefined)
      updateValues.mataPelajaranId = dto.mataPelajaranId;
    if (dto.kelasId !== undefined) updateValues.kelasId = dto.kelasId;
    if (dto.proctorId !== undefined) updateValues.proctorId = dto.proctorId;
    if (dto.scheduledAt !== undefined)
      updateValues.scheduledAt = new Date(dto.scheduledAt);
    if (dto.durationMinutes !== undefined)
      updateValues.durationMinutes = dto.durationMinutes;
    if (dto.randomizeQuestions !== undefined)
      updateValues.randomizeQuestions = dto.randomizeQuestions;
    if (dto.randomizeOptions !== undefined)
      updateValues.randomizeOptions = dto.randomizeOptions;
    if (dto.antiCheatLevel !== undefined)
      updateValues.antiCheatLevel = dto.antiCheatLevel;
    if (dto.resultDetailLevel !== undefined)
      updateValues.resultDetailLevel = dto.resultDetailLevel;

    const [updated] = await this.db
      .update(cbtExamSession)
      .set(updateValues)
      .where(eq(cbtExamSession.id, sessionId))
      .returning();

    return updated;
  }

  /**
   * List exam sessions with filters and pagination.
   */
  async list(tenantId: string, filters: ListSessionsQueryDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(cbtExamSession.tenantId, tenantId)];

    if (filters.status) {
      conditions.push(eq(cbtExamSession.status, filters.status));
    }
    if (filters.kelasId) {
      conditions.push(eq(cbtExamSession.kelasId, filters.kelasId));
    }
    if (filters.mataPelajaranId) {
      conditions.push(
        eq(cbtExamSession.mataPelajaranId, filters.mataPelajaranId),
      );
    }
    if (filters.pelaksanaanUjianId) {
      conditions.push(
        eq(cbtExamSession.pelaksanaanUjianId, filters.pelaksanaanUjianId),
      );
    }

    const whereClause = and(...conditions);

    const [countResult, data] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(cbtExamSession)
        .where(whereClause),
      this.db
        .select()
        .from(cbtExamSession)
        .where(whereClause)
        .orderBy(sql`${cbtExamSession.scheduledAt} DESC`)
        .limit(limit)
        .offset(offset),
    ]);

    const total = countResult[0]?.count ?? 0;

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
   * Get session detail with participant stats (count by status).
   */
  async getById(tenantId: string, sessionId: string) {
    const session = await this.getSessionOrFail(tenantId, sessionId);

    // Get participant stats grouped by status
    const participantStats = await this.db
      .select({
        status: cbtExamParticipant.status,
        count: sql<number>`count(*)::int`,
      })
      .from(cbtExamParticipant)
      .where(eq(cbtExamParticipant.examSessionId, sessionId))
      .groupBy(cbtExamParticipant.status);

    // Get question count
    const [questionCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(cbtExamSessionQuestion)
      .where(eq(cbtExamSessionQuestion.examSessionId, sessionId));

    return {
      ...session,
      questionCount: questionCount?.count ?? 0,
      participantStats: participantStats.reduce(
        (acc, s) => {
          acc[s.status] = s.count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  /**
   * Release results for a completed session.
   * Sets results_released=true.
   */
  async releaseResults(tenantId: string, sessionId: string) {
    const session = await this.getSessionOrFail(tenantId, sessionId);

    if (session.status !== "completed") {
      throw new ConflictException(
        "Hasil ujian hanya dapat dirilis untuk sesi yang sudah selesai (completed)",
      );
    }

    if (session.resultsReleased) {
      throw new ConflictException("Hasil ujian sudah dirilis sebelumnya");
    }

    const [updated] = await this.db
      .update(cbtExamSession)
      .set({ resultsReleased: true, updatedAt: new Date() })
      .where(eq(cbtExamSession.id, sessionId))
      .returning();

    return updated;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  async getSessionOrFail(tenantId: string, sessionId: string) {
    const [session] = await this.db
      .select()
      .from(cbtExamSession)
      .where(
        and(
          eq(cbtExamSession.id, sessionId),
          eq(cbtExamSession.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!session) {
      throw new NotFoundException("Sesi ujian tidak ditemukan");
    }

    return session;
  }

  private async validateScheduledAt(scheduledAt: string) {
    const scheduled = new Date(scheduledAt);
    const minTime = new Date(Date.now() + 5 * 60 * 1000); // now + 5 minutes

    if (scheduled < minTime) {
      throw new BadRequestException(
        "Waktu jadwal harus minimal 5 menit dari sekarang",
      );
    }
  }

  private async validatePelaksanaanUjian(
    tenantId: string,
    pelaksanaanUjianId: string,
  ) {
    const [pu] = await this.db
      .select({
        id: cbtPelaksanaanUjian.id,
        isActive: cbtPelaksanaanUjian.isActive,
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

    if (!pu.isActive) {
      throw new BadRequestException("Pelaksanaan ujian sudah tidak aktif");
    }
  }
}
