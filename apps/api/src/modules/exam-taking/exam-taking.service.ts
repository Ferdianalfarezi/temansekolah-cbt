import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, inArray, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { cbtExamParticipant } from "../../drizzle/schema/cbt-exam-participant";
import { cbtExamSessionQuestion } from "../../drizzle/schema/cbt-exam-session-question";
import { cbtQuestion } from "../../drizzle/schema/cbt-question";
import { cbtAnswer } from "../../drizzle/schema/cbt-answer";
import { cbtBankSoal } from "../../drizzle/schema/cbt-bank-soal";
import { mataPelajaran } from "../../drizzle/schema/lms-tables";
import { SchedulerService } from "../scheduler/scheduler.service";
import { GradingService } from "../grading/grading.service";
import { ProctorGateway } from "../proctor-gateway/proctor.gateway";

/**
 * Randomization mapping stored per participant.
 */
interface RandomizationMapping {
  questionOrder: string[];
  optionMappings: Record<string, string[]>;
}

/**
 * Fisher-Yates shuffle using crypto.randomBytes for secure randomization.
 */
function fisherYatesShuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const randomBuffer = randomBytes(4);
    const j = randomBuffer.readUInt32BE(0) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

@Injectable()
export class ExamTakingService {
  private readonly logger = new Logger(ExamTakingService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly schedulerService: SchedulerService,
    private readonly gradingService: GradingService,
    private readonly proctorGateway: ProctorGateway,
  ) {}

  /**
   * List assigned exam sessions for a siswa.
   * Returns sessions in packaged, active, or completed state.
   * Includes readable names for mata pelajaran and bank soal title.
   */
  async listSessions(siswaAccountId: string) {
    const participants = await this.db
      .select({
        participantId: cbtExamParticipant.id,
        participantStatus: cbtExamParticipant.status,
        startedAt: cbtExamParticipant.startedAt,
        submittedAt: cbtExamParticipant.submittedAt,
        sessionId: cbtExamSession.id,
        sessionStatus: cbtExamSession.status,
        scheduledAt: cbtExamSession.scheduledAt,
        durationMinutes: cbtExamSession.durationMinutes,
        mataPelajaranId: cbtExamSession.mataPelajaranId,
        kelasId: cbtExamSession.kelasId,
        bankSoalId: cbtExamSession.bankSoalId,
        resultsReleased: cbtExamSession.resultsReleased,
        scoreCorrect: cbtExamParticipant.scoreCorrect,
        scoreTotal: cbtExamParticipant.scoreTotal,
        scorePercentage: cbtExamParticipant.scorePercentage,
        // Joined names
        mataPelajaranNama: mataPelajaran.nama,
        bankSoalNama: cbtBankSoal.nama,
      })
      .from(cbtExamParticipant)
      .innerJoin(
        cbtExamSession,
        eq(cbtExamParticipant.examSessionId, cbtExamSession.id),
      )
      .leftJoin(
        mataPelajaran,
        eq(cbtExamSession.mataPelajaranId, mataPelajaran.id),
      )
      .leftJoin(cbtBankSoal, eq(cbtExamSession.bankSoalId, cbtBankSoal.id))
      .where(
        and(
          eq(cbtExamParticipant.siswaAccountId, siswaAccountId),
          inArray(cbtExamSession.status, ["packaged", "active", "completed"]),
        ),
      )
      .orderBy(cbtExamSession.scheduledAt);

    return participants.map((p) => ({
      sessionId: p.sessionId,
      sessionStatus: p.sessionStatus,
      participantId: p.participantId,
      participantStatus: p.participantStatus,
      scheduledAt: p.scheduledAt,
      durationMinutes: p.durationMinutes,
      mataPelajaranId: p.mataPelajaranId,
      kelasId: p.kelasId,
      startedAt: p.startedAt,
      submittedAt: p.submittedAt,
      resultsReleased: p.resultsReleased,
      // Readable names
      title: p.bankSoalNama || null,
      subject: p.mataPelajaranNama || null,
      score: p.resultsReleased
        ? {
            correct: p.scoreCorrect,
            total: p.scoreTotal,
            percentage: p.scorePercentage,
          }
        : null,
    }));
  }

  /**
   * Start an exam for a siswa.
   * Validates eligibility, generates randomization, sets status to in_progress.
   */
  async startExam(siswaAccountId: string, sessionId: string) {
    // 1. Load session
    const sessions = await this.db
      .select()
      .from(cbtExamSession)
      .where(eq(cbtExamSession.id, sessionId))
      .limit(1);

    const session = sessions[0];
    if (!session) {
      throw new NotFoundException("Exam session not found");
    }

    if (session.status !== "active") {
      throw new BadRequestException(
        "Exam session is not active. Cannot start exam.",
      );
    }

    // 2. Load participant
    const participants = await this.db
      .select()
      .from(cbtExamParticipant)
      .where(
        and(
          eq(cbtExamParticipant.examSessionId, sessionId),
          eq(cbtExamParticipant.siswaAccountId, siswaAccountId),
        ),
      )
      .limit(1);

    const participant = participants[0];
    if (!participant) {
      throw new ForbiddenException("You are not assigned to this exam session");
    }

    if (
      participant.status === "submitted" ||
      participant.status === "auto_submitted"
    ) {
      throw new BadRequestException("You have already submitted this exam");
    }

    if (participant.status === "in_progress") {
      // Already in progress — return current state (resume)
      return this.getExamState(participant, session);
    }

    if (participant.status !== "assigned") {
      throw new BadRequestException(
        `Cannot start exam in current status: ${participant.status}`,
      );
    }

    // 3. Load questions for this session
    const sessionQuestions = await this.db
      .select({
        questionId: cbtExamSessionQuestion.questionId,
        nomorUrut: cbtExamSessionQuestion.nomorUrut,
      })
      .from(cbtExamSessionQuestion)
      .where(eq(cbtExamSessionQuestion.examSessionId, sessionId))
      .orderBy(cbtExamSessionQuestion.nomorUrut);

    const questionIds = sessionQuestions.map((sq) => sq.questionId);

    // 4. Generate randomization mapping
    const mapping: RandomizationMapping = {
      questionOrder: questionIds,
      optionMappings: {},
    };

    if (session.randomizeQuestions) {
      mapping.questionOrder = fisherYatesShuffle(questionIds);
    }

    if (session.randomizeOptions) {
      for (const qId of questionIds) {
        const baseOptions = ["A", "B", "C", "D", "E"];
        mapping.optionMappings[qId] = fisherYatesShuffle(baseOptions);
      }
    }

    // 5. Calculate remaining time based on exam end time
    // Late students get reduced time based on how late they are
    const now = new Date();
    const examEndTime = new Date(
      session.scheduledAt.getTime() + session.durationMinutes * 60 * 1000,
    );
    const remainingMs = examEndTime.getTime() - now.getTime();
    const remainingSeconds = Math.floor(remainingMs / 1000);

    if (remainingSeconds <= 0) {
      throw new BadRequestException(
        "Waktu ujian sudah berakhir. Anda tidak dapat memulai ujian.",
      );
    }

    // 6. Update participant to in_progress
    await this.db
      .update(cbtExamParticipant)
      .set({
        status: "in_progress",
        startedAt: now,
        randomizationMapping: mapping,
        remainingSeconds: remainingSeconds,
      })
      .where(eq(cbtExamParticipant.id, participant.id));

    // 7. Schedule auto-submit based on actual remaining time (not full duration)
    const timeoutMs = remainingSeconds * 1000;
    await this.schedulerService.scheduleAutoSubmit(
      participant.id,
      sessionId,
      timeoutMs,
    );

    this.logger.log(
      `Siswa ${siswaAccountId} started exam session ${sessionId} with ${remainingSeconds}s remaining (late by ${session.durationMinutes * 60 - remainingSeconds}s)`,
    );

    // 7. Return questions in randomized order (without jawaban_benar)
    const questions = await this.db
      .select({
        id: cbtQuestion.id,
        teksSoal: cbtQuestion.teksSoal,
        gambarSoalUrl: cbtQuestion.gambarSoalUrl,
        opsiA: cbtQuestion.opsiA,
        gambarAUrl: cbtQuestion.gambarAUrl,
        opsiB: cbtQuestion.opsiB,
        gambarBUrl: cbtQuestion.gambarBUrl,
        opsiC: cbtQuestion.opsiC,
        gambarCUrl: cbtQuestion.gambarCUrl,
        opsiD: cbtQuestion.opsiD,
        gambarDUrl: cbtQuestion.gambarDUrl,
        opsiE: cbtQuestion.opsiE,
        gambarEUrl: cbtQuestion.gambarEUrl,
      })
      .from(cbtQuestion)
      .where(inArray(cbtQuestion.id, questionIds));

    const questionMap = new Map(questions.map((q) => [q.id, q]));

    const orderedQuestions = mapping.questionOrder.map((qId, index) => {
      const q = questionMap.get(qId)!;
      const optionMapping = mapping.optionMappings[qId];

      if (optionMapping) {
        // Reorder options according to the randomized mapping
        return {
          id: q.id,
          nomor: index + 1,
          teksSoal: q.teksSoal,
          gambarSoalUrl: q.gambarSoalUrl,
          options: optionMapping.map((originalKey) => ({
            key: originalKey,
            text: this.getOptionText(q, originalKey),
            imageUrl: this.getOptionImage(q, originalKey),
          })),
        };
      }

      return {
        id: q.id,
        nomor: index + 1,
        teksSoal: q.teksSoal,
        gambarSoalUrl: q.gambarSoalUrl,
        options: this.getDefaultOptions(q),
      };
    });

    return {
      participantId: participant.id,
      sessionId,
      durationMinutes: session.durationMinutes,
      remainingSeconds: session.durationMinutes * 60,
      totalQuestions: orderedQuestions.length,
      questions: orderedQuestions,
      violationCount: 0, // Fresh start has 0 violations
    };
  }

  /**
   * Save an answer for a specific question.
   */
  async saveAnswer(
    siswaAccountId: string,
    sessionId: string,
    questionId: string,
    option: string,
  ) {
    // Validate participant is in_progress
    const participant = await this.getActiveParticipant(
      siswaAccountId,
      sessionId,
    );

    // Validate the question belongs to this session
    const sessionQuestions = await this.db
      .select({ questionId: cbtExamSessionQuestion.questionId })
      .from(cbtExamSessionQuestion)
      .where(
        and(
          eq(cbtExamSessionQuestion.examSessionId, sessionId),
          eq(cbtExamSessionQuestion.questionId, questionId),
        ),
      )
      .limit(1);

    if (sessionQuestions.length === 0) {
      throw new BadRequestException(
        "Question does not belong to this exam session",
      );
    }

    // Upsert answer
    const now = new Date();
    await this.db
      .insert(cbtAnswer)
      .values({
        participantId: participant.id,
        questionId,
        selectedOption: option,
        answeredAt: now,
      })
      .onConflictDoUpdate({
        target: [cbtAnswer.participantId, cbtAnswer.questionId],
        set: {
          selectedOption: option,
          answeredAt: now,
        },
      });

    return { questionId, option, savedAt: now };
  }

  /**
   * Submit the exam (manual submission by siswa).
   */
  async submitExam(siswaAccountId: string, sessionId: string) {
    // Load session - allow submit even if session is completed
    const sessions = await this.db
      .select({ status: cbtExamSession.status })
      .from(cbtExamSession)
      .where(eq(cbtExamSession.id, sessionId))
      .limit(1);

    const session = sessions[0];
    if (!session) {
      throw new NotFoundException("Exam session not found");
    }

    // Allow submit if session is active OR completed (for late submissions)
    if (!["active", "completed"].includes(session.status)) {
      throw new BadRequestException(
        `Cannot submit exam. Session status: ${session.status}`,
      );
    }

    // Load participant
    const participants = await this.db
      .select()
      .from(cbtExamParticipant)
      .where(
        and(
          eq(cbtExamParticipant.examSessionId, sessionId),
          eq(cbtExamParticipant.siswaAccountId, siswaAccountId),
        ),
      )
      .limit(1);

    const participant = participants[0];
    if (!participant) {
      throw new ForbiddenException("You are not assigned to this exam session");
    }

    // Check if already submitted
    if (["submitted", "auto_submitted"].includes(participant.status)) {
      throw new BadRequestException("You have already submitted this exam");
    }

    // Allow submit only if in_progress (or potentially disconnected/paused)
    if (
      !["in_progress", "disconnected", "paused"].includes(participant.status)
    ) {
      throw new BadRequestException(
        `Cannot submit exam. Current status: ${participant.status}`,
      );
    }

    // Mark as submitted
    const now = new Date();
    await this.db
      .update(cbtExamParticipant)
      .set({
        status: "submitted",
        submittedAt: now,
        submissionType: "manual",
      })
      .where(eq(cbtExamParticipant.id, participant.id));

    // Cancel auto-submit timer
    await this.schedulerService.cancelAutoSubmit(participant.id);

    // Count answers
    const answers = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(cbtAnswer)
      .where(eq(cbtAnswer.participantId, participant.id));

    const answeredCount = answers[0]?.count ?? 0;

    // Count total questions in session
    const totalQuestions = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(cbtExamSessionQuestion)
      .where(eq(cbtExamSessionQuestion.examSessionId, sessionId));

    const totalCount = totalQuestions[0]?.count ?? 0;
    const unansweredCount = totalCount - answeredCount;

    this.logger.log(
      `Siswa ${siswaAccountId} manually submitted exam session ${sessionId}`,
    );

    // Trigger grading to calculate score
    let scorePercentage: number | null = null;
    try {
      const gradingResult = await this.gradingService.gradeParticipant(
        participant.id,
      );
      scorePercentage = gradingResult.scorePercentage;
      this.logger.log(
        `Grading completed for participant ${participant.id}: ${gradingResult.scoreCorrect}/${gradingResult.scoreTotal} (${gradingResult.scorePercentage}%)`,
      );
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to grade participant ${participant.id}: ${error.message}`,
        error.stack,
      );
      // Don't throw - the submission is already saved, grading can be retried
    }

    // Notify proctors of submission
    this.proctorGateway.emitParticipantUpdate(sessionId, participant.id, {
      status: "submitted",
      submittedAt: now.toISOString(),
      scorePercentage,
    });

    return {
      status: "submitted",
      submittedAt: now,
      answeredCount,
      unansweredCount,
      totalQuestions: totalCount,
    };
  }

  /**
   * Get exam results (if released).
   */
  async getResult(siswaAccountId: string, sessionId: string) {
    // Load session
    const sessions = await this.db
      .select()
      .from(cbtExamSession)
      .where(eq(cbtExamSession.id, sessionId))
      .limit(1);

    const session = sessions[0];
    if (!session) {
      throw new NotFoundException("Exam session not found");
    }

    // Check results released
    if (!session.resultsReleased) {
      throw new ForbiddenException(
        "Results have not been released for this session",
      );
    }

    // Load participant
    const participants = await this.db
      .select()
      .from(cbtExamParticipant)
      .where(
        and(
          eq(cbtExamParticipant.examSessionId, sessionId),
          eq(cbtExamParticipant.siswaAccountId, siswaAccountId),
        ),
      )
      .limit(1);

    const participant = participants[0];
    if (!participant) {
      throw new ForbiddenException("You are not assigned to this exam session");
    }

    const baseResult = {
      sessionId,
      participantId: participant.id,
      status: participant.status,
      submittedAt: participant.submittedAt,
      scoreCorrect: participant.scoreCorrect,
      scoreTotal: participant.scoreTotal,
      scorePercentage: participant.scorePercentage,
    };

    // Based on result_detail_level
    if (session.resultDetailLevel === "score_only") {
      return baseResult;
    }

    // For score_with_indicator or full_detail, include answer indicators
    const answers = await this.db
      .select({
        questionId: cbtAnswer.questionId,
        selectedOption: cbtAnswer.selectedOption,
        isCorrect: cbtAnswer.isCorrect,
      })
      .from(cbtAnswer)
      .where(eq(cbtAnswer.participantId, participant.id));

    if (session.resultDetailLevel === "score_with_indicator") {
      return {
        ...baseResult,
        answers: answers.map((a) => ({
          questionId: a.questionId,
          isCorrect: a.isCorrect,
        })),
      };
    }

    // full_detail — check if all participants have submitted first
    if (session.resultDetailLevel === "full_detail") {
      const notSubmitted = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(cbtExamParticipant)
        .where(
          and(
            eq(cbtExamParticipant.examSessionId, sessionId),
            inArray(cbtExamParticipant.status, [
              "assigned",
              "in_progress",
              "paused",
              "disconnected",
            ]),
          ),
        );

      if ((notSubmitted[0]?.count ?? 0) > 0) {
        // Some participants haven't submitted yet — only show indicators
        return {
          ...baseResult,
          answers: answers.map((a) => ({
            questionId: a.questionId,
            isCorrect: a.isCorrect,
          })),
          note: "Full detail will be available after all participants have submitted",
        };
      }

      // Load questions with correct answers for full detail
      const questionIds = answers.map((a) => a.questionId);
      const questions =
        questionIds.length > 0
          ? await this.db
              .select({
                id: cbtQuestion.id,
                teksSoal: cbtQuestion.teksSoal,
                jawabanBenar: cbtQuestion.jawabanBenar,
              })
              .from(cbtQuestion)
              .where(inArray(cbtQuestion.id, questionIds))
          : [];

      const questionMap = new Map(questions.map((q) => [q.id, q]));

      return {
        ...baseResult,
        answers: answers.map((a) => {
          const q = questionMap.get(a.questionId);
          return {
            questionId: a.questionId,
            selectedOption: a.selectedOption,
            isCorrect: a.isCorrect,
            correctOption: q?.jawabanBenar ?? null,
          };
        }),
      };
    }

    return baseResult;
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  /**
   * Get the currently active (in_progress) participant for a siswa in a session.
   */
  private async getActiveParticipant(
    siswaAccountId: string,
    sessionId: string,
  ) {
    // Validate session is active
    const sessions = await this.db
      .select({ status: cbtExamSession.status })
      .from(cbtExamSession)
      .where(eq(cbtExamSession.id, sessionId))
      .limit(1);

    const session = sessions[0];
    if (!session) {
      throw new NotFoundException("Exam session not found");
    }
    if (session.status !== "active") {
      throw new BadRequestException("Exam session is not active");
    }

    // Load participant
    const participants = await this.db
      .select()
      .from(cbtExamParticipant)
      .where(
        and(
          eq(cbtExamParticipant.examSessionId, sessionId),
          eq(cbtExamParticipant.siswaAccountId, siswaAccountId),
        ),
      )
      .limit(1);

    const participant = participants[0];
    if (!participant) {
      throw new ForbiddenException("You are not assigned to this exam session");
    }

    if (participant.status !== "in_progress") {
      throw new BadRequestException(
        `Cannot perform this action. Current status: ${participant.status}`,
      );
    }

    return participant;
  }

  /**
   * Get exam state for a participant who has already started (for resume).
   */
  private async getExamState(participant: any, session: any) {
    const mapping = participant.randomizationMapping as RandomizationMapping;
    const questionIds = mapping?.questionOrder ?? [];

    if (questionIds.length === 0) {
      return {
        participantId: participant.id,
        sessionId: session.id,
        durationMinutes: session.durationMinutes,
        remainingSeconds: this.calculateRemainingSeconds(participant, session),
        totalQuestions: 0,
        questions: [],
        savedAnswers: {},
        violationCount: participant.violationCount ?? 0, // Sync from DB on resume
      };
    }

    // Load questions
    const questions = await this.db
      .select({
        id: cbtQuestion.id,
        teksSoal: cbtQuestion.teksSoal,
        gambarSoalUrl: cbtQuestion.gambarSoalUrl,
        opsiA: cbtQuestion.opsiA,
        gambarAUrl: cbtQuestion.gambarAUrl,
        opsiB: cbtQuestion.opsiB,
        gambarBUrl: cbtQuestion.gambarBUrl,
        opsiC: cbtQuestion.opsiC,
        gambarCUrl: cbtQuestion.gambarCUrl,
        opsiD: cbtQuestion.opsiD,
        gambarDUrl: cbtQuestion.gambarDUrl,
        opsiE: cbtQuestion.opsiE,
        gambarEUrl: cbtQuestion.gambarEUrl,
      })
      .from(cbtQuestion)
      .where(inArray(cbtQuestion.id, questionIds));

    const questionMap = new Map(questions.map((q) => [q.id, q]));

    const orderedQuestions = questionIds
      .map((qId, index) => {
        const q = questionMap.get(qId);
        if (!q) return null;

        const optionMapping = mapping?.optionMappings?.[qId];
        if (optionMapping) {
          return {
            id: q.id,
            nomor: index + 1,
            teksSoal: q.teksSoal,
            gambarSoalUrl: q.gambarSoalUrl,
            options: optionMapping.map((originalKey) => ({
              key: originalKey,
              text: this.getOptionText(q, originalKey),
              imageUrl: this.getOptionImage(q, originalKey),
            })),
          };
        }

        return {
          id: q.id,
          nomor: index + 1,
          teksSoal: q.teksSoal,
          gambarSoalUrl: q.gambarSoalUrl,
          options: this.getDefaultOptions(q),
        };
      })
      .filter(Boolean);

    // Load existing answers
    const answers = await this.db
      .select({
        questionId: cbtAnswer.questionId,
        selectedOption: cbtAnswer.selectedOption,
      })
      .from(cbtAnswer)
      .where(eq(cbtAnswer.participantId, participant.id));

    const savedAnswers: Record<string, string> = {};
    for (const a of answers) {
      if (a.selectedOption) {
        savedAnswers[a.questionId] = a.selectedOption;
      }
    }

    return {
      participantId: participant.id,
      sessionId: session.id,
      durationMinutes: session.durationMinutes,
      remainingSeconds: this.calculateRemainingSeconds(participant, session),
      totalQuestions: orderedQuestions.length,
      questions: orderedQuestions,
      savedAnswers,
      violationCount: participant.violationCount ?? 0, // Sync from DB on resume
    };
  }

  /**
   * Calculate remaining seconds based on started_at and duration.
   */
  private calculateRemainingSeconds(participant: any, session: any): number {
    if (!participant.startedAt) return session.durationMinutes * 60;

    const elapsed = Math.floor(
      (Date.now() - new Date(participant.startedAt).getTime()) / 1000,
    );
    const totalSeconds =
      session.durationMinutes * 60 + (participant.extensionSeconds || 0);
    return Math.max(0, totalSeconds - elapsed);
  }

  private getOptionText(question: any, key: string): string | null {
    const map: Record<string, string> = {
      A: "opsiA",
      B: "opsiB",
      C: "opsiC",
      D: "opsiD",
      E: "opsiE",
    };
    return question[map[key]] ?? null;
  }

  private getOptionImage(question: any, key: string): string | null {
    const map: Record<string, string> = {
      A: "gambarAUrl",
      B: "gambarBUrl",
      C: "gambarCUrl",
      D: "gambarDUrl",
      E: "gambarEUrl",
    };
    return question[map[key]] ?? null;
  }

  private getDefaultOptions(question: any) {
    const options = [
      { key: "A", text: question.opsiA, imageUrl: question.gambarAUrl },
      { key: "B", text: question.opsiB, imageUrl: question.gambarBUrl },
      { key: "C", text: question.opsiC, imageUrl: question.gambarCUrl },
      { key: "D", text: question.opsiD, imageUrl: question.gambarDUrl },
    ];

    if (question.opsiE) {
      options.push({
        key: "E",
        text: question.opsiE,
        imageUrl: question.gambarEUrl,
      });
    }

    return options;
  }

  /**
   * Record a violation event from anti-cheat.
   */
  async recordViolation(
    siswaAccountId: string,
    sessionId: string,
    violationType: string,
    durationMs?: number,
  ) {
    // Validate violation type
    const validTypes = [
      "tab_switch",
      "focus_loss",
      "fullscreen_exit",
      "multiple_login",
    ];
    if (!validTypes.includes(violationType)) {
      throw new BadRequestException(`Invalid violation type: ${violationType}`);
    }

    // Load participant (must be in_progress)
    const participants = await this.db
      .select({
        id: cbtExamParticipant.id,
        status: cbtExamParticipant.status,
        violationCount: cbtExamParticipant.violationCount,
      })
      .from(cbtExamParticipant)
      .where(
        and(
          eq(cbtExamParticipant.examSessionId, sessionId),
          eq(cbtExamParticipant.siswaAccountId, siswaAccountId),
        ),
      )
      .limit(1);

    const participant = participants[0];
    if (!participant) {
      throw new ForbiddenException("You are not assigned to this exam session");
    }

    // Only record violations for in_progress participants
    if (participant.status !== "in_progress") {
      return { recorded: false, reason: "Participant not in progress" };
    }

    // Insert violation event
    await this.db.execute(sql`
      INSERT INTO cbt_violation_event (participant_id, violation_type, duration_ms, detected_at)
      VALUES (${participant.id}, ${violationType}, ${durationMs ?? null}, NOW())
    `);

    // Increment violation count on participant
    const newCount = (participant.violationCount || 0) + 1;
    await this.db
      .update(cbtExamParticipant)
      .set({
        violationCount: newCount,
        isFlaggedCheating: newCount >= 3, // Flag if 3+ violations
      })
      .where(eq(cbtExamParticipant.id, participant.id));

    this.logger.log(
      `Violation recorded for participant ${participant.id}: ${violationType} (count: ${newCount})`,
    );

    return {
      recorded: true,
      violationType,
      totalViolations: newCount,
      isFlagged: newCount >= 3,
    };
  }
}
