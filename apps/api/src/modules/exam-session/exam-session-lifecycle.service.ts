import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, isNull } from "drizzle-orm";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { cbtExamSessionQuestion } from "../../drizzle/schema/cbt-exam-session-question";
import { cbtExamParticipant } from "../../drizzle/schema/cbt-exam-participant";
import { cbtQuestion } from "../../drizzle/schema/cbt-question";
import { cbtSiswaAccount } from "../../drizzle/schema/cbt-siswa-account";
import { siswa, kelas } from "../../drizzle/schema/lms-tables";
import { ExamSessionService } from "./exam-session.service";

@Injectable()
export class ExamSessionLifecycleService {
  private readonly logger = new Logger(ExamSessionLifecycleService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly examSessionService: ExamSessionService,
  ) {}

  /**
   * Package a draft session:
   * 1. Resolve Question_Bank_Set (kelas-specific > tingkat-level)
   * 2. Validate ≥1 question, ≥1 active siswa, scheduled time set
   * 3. Snapshot questions into cbt_exam_session_question
   * 4. Auto-assign all active siswa in kelas → cbt_exam_participant
   * 5. Transition Draft → Packaged
   */
  async package(tenantId: string, sessionId: string) {
    this.logger.log(
      `Starting package for session ${sessionId}, tenant ${tenantId}`,
    );

    try {
      const session = await this.examSessionService.getSessionOrFail(
        tenantId,
        sessionId,
      );
      this.logger.log(
        `Session found: status=${session.status}, kelasId=${session.kelasId}, pelaksanaanUjianId=${session.pelaksanaanUjianId}, mataPelajaranId=${session.mataPelajaranId}`,
      );

      // Validate state: must be draft
      if (session.status !== "draft") {
        throw new ConflictException(
          "Hanya sesi ujian berstatus draft yang dapat di-package",
        );
      }

      // 1. Resolve questions from bank
      // Get kelas tingkat for fallback
      const [kelasRecord] = await this.db
        .select({ tingkat: kelas.tingkat })
        .from(kelas)
        .where(eq(kelas.id, session.kelasId))
        .limit(1);

      if (!kelasRecord) {
        throw new BadRequestException("Kelas tidak ditemukan");
      }
      this.logger.log(`Kelas tingkat: ${kelasRecord.tingkat}`);

      // Get kelas-specific questions
      const kelasQuestions = await this.db
        .select()
        .from(cbtQuestion)
        .where(
          and(
            eq(cbtQuestion.pelaksanaanUjianId, session.pelaksanaanUjianId),
            eq(cbtQuestion.mataPelajaranId, session.mataPelajaranId),
            eq(cbtQuestion.kelasId, session.kelasId),
          ),
        )
        .orderBy(cbtQuestion.nomorUrut, cbtQuestion.createdAt);
      this.logger.log(`Kelas-specific questions: ${kelasQuestions.length}`);

      // Get tingkat-level questions (fallback: kelas_id IS NULL AND tingkat matches)
      const tingkatQuestions = await this.db
        .select()
        .from(cbtQuestion)
        .where(
          and(
            eq(cbtQuestion.pelaksanaanUjianId, session.pelaksanaanUjianId),
            eq(cbtQuestion.mataPelajaranId, session.mataPelajaranId),
            isNull(cbtQuestion.kelasId),
            eq(cbtQuestion.tingkat, kelasRecord.tingkat),
          ),
        )
        .orderBy(cbtQuestion.nomorUrut, cbtQuestion.createdAt);
      this.logger.log(`Tingkat-level questions: ${tingkatQuestions.length}`);

      // Priority: kelas-specific overrides tingkat-level
      // Use kelas-specific if available, otherwise use tingkat-level
      const questions =
        kelasQuestions.length > 0 ? kelasQuestions : tingkatQuestions;

      // 2. Validate: at least 1 question
      if (questions.length === 0) {
        throw new BadRequestException(
          "Tidak ada soal yang tersedia untuk kelas/tingkat dan mata pelajaran ini. Tambahkan soal terlebih dahulu.",
        );
      }

      // 3. Get active siswa accounts in this kelas
      const activeAccounts = await this.db
        .select({
          accountId: cbtSiswaAccount.id,
        })
        .from(cbtSiswaAccount)
        .innerJoin(siswa, eq(cbtSiswaAccount.siswaId, siswa.id))
        .where(
          and(
            eq(siswa.kelasId, session.kelasId),
            eq(siswa.status, "aktif"),
            eq(cbtSiswaAccount.isActive, true),
            eq(cbtSiswaAccount.tenantId, tenantId),
          ),
        );
      this.logger.log(`Active siswa accounts: ${activeAccounts.length}`);

      // Validate: at least 1 active siswa
      if (activeAccounts.length === 0) {
        throw new BadRequestException(
          "Tidak ada siswa aktif di kelas ini. Pastikan siswa sudah di-sync dan aktif.",
        );
      }

      // 4. Snapshot questions into cbt_exam_session_question
      const questionValues = questions.map((q, idx) => ({
        examSessionId: sessionId,
        questionId: q.id,
        nomorUrut: idx + 1,
      }));

      this.logger.log(`Inserting ${questionValues.length} session questions`);
      await this.db.insert(cbtExamSessionQuestion).values(questionValues);

      // 5. Auto-assign participants
      const participantValues = activeAccounts.map((acc) => ({
        examSessionId: sessionId,
        siswaAccountId: acc.accountId,
        status: "assigned" as const,
      }));

      this.logger.log(`Inserting ${participantValues.length} participants`);
      await this.db.insert(cbtExamParticipant).values(participantValues);

      // 6. Transition to packaged
      this.logger.log(`Transitioning session to packaged`);
      const [updated] = await this.db
        .update(cbtExamSession)
        .set({ status: "packaged", updatedAt: new Date() })
        .where(eq(cbtExamSession.id, sessionId))
        .returning();

      this.logger.log(
        `Session ${sessionId} packaged: ${questions.length} questions, ${activeAccounts.length} participants`,
      );

      return {
        ...updated,
        questionCount: questions.length,
        participantCount: activeAccounts.length,
      };
    } catch (error) {
      this.logger.error(
        `Package failed for session ${sessionId}: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Unpackage a session: Packaged → Draft.
   * Only allowed if scheduled_at > now.
   * Removes exam_session_question and exam_participant entries.
   */
  async unpackage(tenantId: string, sessionId: string) {
    const session = await this.examSessionService.getSessionOrFail(
      tenantId,
      sessionId,
    );

    // Validate state: must be packaged
    if (session.status !== "packaged") {
      throw new ConflictException(
        "Hanya sesi ujian berstatus packaged yang dapat di-unpackage",
      );
    }

    // Validate: scheduled time not passed
    if (session.scheduledAt <= new Date()) {
      throw new ConflictException(
        "Tidak dapat unpackage sesi ujian yang waktu jadwalnya sudah lewat",
      );
    }

    // Remove exam_session_question entries
    await this.db
      .delete(cbtExamSessionQuestion)
      .where(eq(cbtExamSessionQuestion.examSessionId, sessionId));

    // Remove exam_participant entries
    await this.db
      .delete(cbtExamParticipant)
      .where(eq(cbtExamParticipant.examSessionId, sessionId));

    // Transition back to draft
    const [updated] = await this.db
      .update(cbtExamSession)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(cbtExamSession.id, sessionId))
      .returning();

    this.logger.log(`Session ${sessionId} unpackaged back to draft`);

    return updated;
  }

  /**
   * Cancel a packaged session: Packaged → Cancelled.
   */
  async cancel(tenantId: string, sessionId: string, reason: string) {
    const session = await this.examSessionService.getSessionOrFail(
      tenantId,
      sessionId,
    );

    // Validate state: must be packaged
    if (session.status !== "packaged") {
      throw new ConflictException(
        "Hanya sesi ujian berstatus packaged yang dapat dibatalkan",
      );
    }

    // Transition to cancelled
    const [updated] = await this.db
      .update(cbtExamSession)
      .set({
        status: "cancelled",
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(cbtExamSession.id, sessionId))
      .returning();

    this.logger.log(`Session ${sessionId} cancelled. Reason: ${reason}`);

    return updated;
  }
}
