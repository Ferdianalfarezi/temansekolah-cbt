import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, sql, SQL, inArray } from "drizzle-orm";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { cbtExamSessionQuestion } from "../../drizzle/schema/cbt-exam-session-question";
import { cbtExamParticipant } from "../../drizzle/schema/cbt-exam-participant";
import { cbtPelaksanaanUjian } from "../../drizzle/schema/cbt-pelaksanaan-ujian";
import { cbtViolationEvent } from "../../drizzle/schema/cbt-violation-event";
import { cbtProctorAction } from "../../drizzle/schema/cbt-proctor-action";
import { cbtSiswaAccount } from "../../drizzle/schema/cbt-siswa-account";
import {
  kelas,
  mataPelajaran,
  user,
  siswa as siswaTbl,
} from "../../drizzle/schema/lms-tables";
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
   * Joins with kelas, mata_pelajaran, and user tables for readable names.
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
        .select({
          id: cbtExamSession.id,
          tenantId: cbtExamSession.tenantId,
          pelaksanaanUjianId: cbtExamSession.pelaksanaanUjianId,
          mataPelajaranId: cbtExamSession.mataPelajaranId,
          kelasId: cbtExamSession.kelasId,
          proctorId: cbtExamSession.proctorId,
          scheduledAt: cbtExamSession.scheduledAt,
          durationMinutes: cbtExamSession.durationMinutes,
          randomizeQuestions: cbtExamSession.randomizeQuestions,
          randomizeOptions: cbtExamSession.randomizeOptions,
          antiCheatLevel: cbtExamSession.antiCheatLevel,
          resultDetailLevel: cbtExamSession.resultDetailLevel,
          resultsReleased: cbtExamSession.resultsReleased,
          status: cbtExamSession.status,
          cancellationReason: cbtExamSession.cancellationReason,
          createdAt: cbtExamSession.createdAt,
          updatedAt: cbtExamSession.updatedAt,
          // Joined names
          kelasNama: kelas.nama,
          mataPelajaranNama: mataPelajaran.nama,
          proctorNama: user.nama,
        })
        .from(cbtExamSession)
        .leftJoin(kelas, eq(cbtExamSession.kelasId, kelas.id))
        .leftJoin(
          mataPelajaran,
          eq(cbtExamSession.mataPelajaranId, mataPelajaran.id),
        )
        .leftJoin(user, eq(cbtExamSession.proctorId, user.id))
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

  /**
   * Get post-exam report with violations, proctor actions, and early submissions.
   */
  async getReport(tenantId: string, sessionId: string) {
    const session = await this.getSessionOrFail(tenantId, sessionId);

    // Get all participants with siswa info (join through cbtSiswaAccount to siswa)
    const participants = await this.db
      .select({
        id: cbtExamParticipant.id,
        siswaAccountId: cbtExamParticipant.siswaAccountId,
        status: cbtExamParticipant.status,
        startedAt: cbtExamParticipant.startedAt,
        submittedAt: cbtExamParticipant.submittedAt,
        violationCount: cbtExamParticipant.violationCount,
        isFlaggedCheating: cbtExamParticipant.isFlaggedCheating,
        isEarlySubmission: cbtExamParticipant.isEarlySubmission,
        scoreCorrect: cbtExamParticipant.scoreCorrect,
        scoreTotal: cbtExamParticipant.scoreTotal,
        scorePercentage: cbtExamParticipant.scorePercentage,
        submissionType: cbtExamParticipant.submissionType,
        namaSiswa: siswaTbl.nama,
        nisn: cbtSiswaAccount.nisn,
      })
      .from(cbtExamParticipant)
      .innerJoin(
        cbtSiswaAccount,
        eq(cbtExamParticipant.siswaAccountId, cbtSiswaAccount.id),
      )
      .innerJoin(siswaTbl, eq(cbtSiswaAccount.siswaId, siswaTbl.id))
      .where(eq(cbtExamParticipant.examSessionId, sessionId));

    const participantMap = new Map(participants.map((p) => [p.id, p]));
    const participantIds = participants.map((p) => p.id);

    // Get violations grouped by participant and type
    const violations =
      participantIds.length > 0
        ? await this.db
            .select({
              participantId: cbtViolationEvent.participantId,
              violationType: cbtViolationEvent.violationType,
              count: sql<number>`count(*)::int`,
              detectedAt: sql<string>`min(${cbtViolationEvent.detectedAt})`,
            })
            .from(cbtViolationEvent)
            .where(inArray(cbtViolationEvent.participantId, participantIds))
            .groupBy(
              cbtViolationEvent.participantId,
              cbtViolationEvent.violationType,
            )
        : [];

    // Get proctor actions
    const proctorActions = await this.db
      .select({
        participantId: cbtProctorAction.participantId,
        actionType: cbtProctorAction.actionType,
        extensionMinutes: cbtProctorAction.extensionMinutes,
        reason: cbtProctorAction.reason,
        createdAt: cbtProctorAction.createdAt,
      })
      .from(cbtProctorAction)
      .where(eq(cbtProctorAction.examSessionId, sessionId))
      .orderBy(cbtProctorAction.createdAt);

    // Build violations response with siswa names
    const violationsWithNames = violations.map((v) => {
      const participant = participantMap.get(v.participantId);
      return {
        participantId: v.participantId,
        namaSiswa: participant?.namaSiswa || "-",
        nisn: participant?.nisn || "-",
        violationType: v.violationType,
        count: v.count,
        detectedAt: v.detectedAt,
      };
    });

    // Build proctor actions response with siswa names
    const proctorActionsWithNames = proctorActions.map((a) => {
      const participant = participantMap.get(a.participantId);
      return {
        participantId: a.participantId,
        namaSiswa: participant?.namaSiswa || "-",
        actionType: a.actionType,
        extensionMinutes: a.extensionMinutes,
        reason: a.reason,
        createdAt: a.createdAt,
      };
    });

    // Get early submissions (submitted with isEarlySubmission=true)
    const earlySubmissions = participants
      .filter((p) => p.isEarlySubmission && p.submittedAt)
      .map((p) => {
        // Calculate duration percentage
        const startTime = p.startedAt ? new Date(p.startedAt).getTime() : 0;
        const submitTime = p.submittedAt
          ? new Date(p.submittedAt).getTime()
          : 0;
        const actualDurationMs = submitTime - startTime;
        const totalDurationMs = session.durationMinutes * 60 * 1000;
        const durationPct =
          totalDurationMs > 0
            ? Math.round((actualDurationMs / totalDurationMs) * 100)
            : 0;

        return {
          participantId: p.id,
          namaSiswa: p.namaSiswa,
          nisn: p.nisn || "-",
          durationPct,
          submittedAt: p.submittedAt,
        };
      });

    // Calculate summary
    const totalParticipants = participants.length;
    const totalSubmitted = participants.filter(
      (p) => p.submissionType === "manual",
    ).length;
    const totalAutoSubmitted = participants.filter(
      (p) => p.submissionType === "auto",
    ).length;
    const totalFlagged = participants.filter((p) => p.isFlaggedCheating).length;

    const scoresWithPercentage = participants
      .filter((p) => p.scorePercentage !== null)
      .map((p) => Number(p.scorePercentage));
    const averageScore =
      scoresWithPercentage.length > 0
        ? Math.round(
            scoresWithPercentage.reduce((a, b) => a + b, 0) /
              scoresWithPercentage.length,
          )
        : null;

    return {
      sessionId,
      violations: violationsWithNames,
      proctorActions: proctorActionsWithNames,
      earlySubmissions,
      summary: {
        totalParticipants,
        totalSubmitted,
        totalAutoSubmitted,
        totalFlagged,
        averageScore,
      },
    };
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
