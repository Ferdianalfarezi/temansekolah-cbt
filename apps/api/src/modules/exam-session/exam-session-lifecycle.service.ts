import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { cbtExamSessionQuestion } from "../../drizzle/schema/cbt-exam-session-question";
import { cbtExamParticipant } from "../../drizzle/schema/cbt-exam-participant";
import { cbtQuestion } from "../../drizzle/schema/cbt-question";
import { cbtSiswaAccount } from "../../drizzle/schema/cbt-siswa-account";
import { siswa } from "../../drizzle/schema/lms-tables";
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
   * 1. Get questions from the linked bank soal
   * 2. Validate ≥1 question, ≥1 active siswa
   * 3. Snapshot questions into cbt_exam_session_question
   * 4. Auto-assign all active siswa in kelas → cbt_exam_participant
   * 5. Transition Draft → Packaged
   */
  async package(tenantId: string, sessionId: string) {
    this.logger.log(
      `Starting package for session ${sessionId}, tenant ${tenantId}`,
    );

    const session = await this.examSessionService.getSessionOrFail(
      tenantId,
      sessionId,
    );
    this.logger.log(
      `Session found: status=${session.status}, kelasId=${session.kelasId}, bankSoalId=${session.bankSoalId}`,
    );

    // Validate state: must be draft
    if (session.status !== "draft") {
      throw new ConflictException(
        "Hanya sesi ujian berstatus draft yang dapat di-package",
      );
    }

    // Validate: bankSoalId is required
    if (!session.bankSoalId) {
      throw new BadRequestException(
        "Sesi ujian tidak memiliki bank soal. Pilih bank soal terlebih dahulu.",
      );
    }

    // 1. Get questions from the linked bank soal
    const questions = await this.db
      .select()
      .from(cbtQuestion)
      .where(eq(cbtQuestion.bankSoalId, session.bankSoalId))
      .orderBy(cbtQuestion.nomorUrut, cbtQuestion.createdAt);
    this.logger.log(`Bank soal questions: ${questions.length}`);

    // 2. Validate: at least 1 question
    if (questions.length === 0) {
      throw new BadRequestException(
        "Bank soal tidak memiliki soal. Tambahkan soal terlebih dahulu.",
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

    // 4-6. Execute inserts and status update
    const questionValues = questions.map((q, idx) => ({
      examSessionId: sessionId,
      questionId: q.id,
      nomorUrut: idx + 1,
    }));

    const participantValues = activeAccounts.map((acc) => ({
      examSessionId: sessionId,
      siswaAccountId: acc.accountId,
      status: "assigned" as const,
    }));

    this.logger.log(
      `Starting transaction: ${questionValues.length} questions, ${participantValues.length} participants`,
    );

    try {
      // Insert questions (ignore duplicates if any)
      await this.db
        .insert(cbtExamSessionQuestion)
        .values(questionValues)
        .onConflictDoNothing();

      // Insert participants (ignore duplicates if any)
      await this.db
        .insert(cbtExamParticipant)
        .values(participantValues)
        .onConflictDoNothing();

      // Update session status
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
        `Package transaction failed for session ${sessionId}: ${error instanceof Error ? error.message : "Unknown error"}`,
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
