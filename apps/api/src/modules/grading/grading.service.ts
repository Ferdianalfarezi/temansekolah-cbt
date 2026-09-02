import { Inject, Injectable, Logger } from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, inArray } from "drizzle-orm";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtExamParticipant } from "../../drizzle/schema/cbt-exam-participant";
import { cbtExamSessionQuestion } from "../../drizzle/schema/cbt-exam-session-question";
import { cbtQuestion } from "../../drizzle/schema/cbt-question";
import { cbtAnswer } from "../../drizzle/schema/cbt-answer";

export interface GradingResult {
  participantId: string;
  scoreCorrect: number;
  scoreTotal: number;
  scorePercentage: number;
}

@Injectable()
export class GradingService {
  private readonly logger = new Logger(GradingService.name);

  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  /**
   * Grade a participant's exam.
   *
   * Logic:
   * 1. Load participant record
   * 2. Load all session questions (to determine total count)
   * 3. Load correct answers (jawaban_benar) for each question
   * 4. Load participant's submitted answers
   * 5. Compare selected_option directly against jawaban_benar
   *    (No randomization reversal needed — the frontend stores original keys)
   * 6. Update each cbt_answer.is_correct
   * 7. Store aggregate score on cbt_exam_participant
   *
   * Determinism: This is a pure comparison function over stored data.
   * Same inputs always produce the same output.
   *
   * SLA: O(n) over questions — well under 5s for any reasonable exam size.
   * A timeout warning is logged if grading exceeds 5 seconds.
   */
  async gradeParticipant(participantId: string): Promise<GradingResult> {
    const startTime = Date.now();

    // 1. Load participant
    const participants = await this.db
      .select({
        id: cbtExamParticipant.id,
        examSessionId: cbtExamParticipant.examSessionId,
      })
      .from(cbtExamParticipant)
      .where(eq(cbtExamParticipant.id, participantId))
      .limit(1);

    const participant = participants[0];
    if (!participant) {
      throw new Error(`Participant not found: ${participantId}`);
    }

    // 2. Load all questions assigned to this session
    const sessionQuestions = await this.db
      .select({
        questionId: cbtExamSessionQuestion.questionId,
      })
      .from(cbtExamSessionQuestion)
      .where(
        eq(cbtExamSessionQuestion.examSessionId, participant.examSessionId),
      );

    const questionIds = sessionQuestions.map((sq) => sq.questionId);

    if (questionIds.length === 0) {
      // Edge case: no questions in session
      const result: GradingResult = {
        participantId,
        scoreCorrect: 0,
        scoreTotal: 0,
        scorePercentage: 0,
      };
      await this.updateParticipantScore(participantId, result);
      this.checkSla(startTime, participantId);
      return result;
    }

    // 3. Load correct answers for each question (only PG questions have jawabanBenar)
    const questions = await this.db
      .select({
        id: cbtQuestion.id,
        tipeSoal: cbtQuestion.tipeSoal,
        jawabanBenar: cbtQuestion.jawabanBenar,
      })
      .from(cbtQuestion)
      .where(inArray(cbtQuestion.id, questionIds));

    // Only count PG questions for scoring - essay questions are excluded
    const pgQuestions = questions.filter((q) => q.tipeSoal === "pilihan_ganda");
    const pgScoreTotal = pgQuestions.length;

    if (pgScoreTotal === 0) {
      // All questions are essay type - no auto-grading needed
      const result: GradingResult = {
        participantId,
        scoreCorrect: 0,
        scoreTotal: 0,
        scorePercentage: 0,
      };
      await this.updateParticipantScore(participantId, result);
      this.checkSla(startTime, participantId);
      return result;
    }

    const correctAnswerMap = new Map<string, string>();
    for (const q of pgQuestions) {
      // For PG questions, jawabanBenar should not be null
      if (q.jawabanBenar) {
        correctAnswerMap.set(q.id, q.jawabanBenar);
      }
    }

    // 4. Load participant's answers
    const answers = await this.db
      .select({
        id: cbtAnswer.id,
        questionId: cbtAnswer.questionId,
        selectedOption: cbtAnswer.selectedOption,
      })
      .from(cbtAnswer)
      .where(eq(cbtAnswer.participantId, participantId));

    // 5. Grade each answer: compare selected_option against jawaban_benar
    // The selected_option already stores the ORIGINAL key (A-E) because
    // the exam-taking service returns options with key=originalKey.
    // No randomization reversal is needed.
    // Only PG answers are graded - essay answers are excluded from scoring.
    let scoreCorrect = 0;
    const answerUpdates: { id: string; isCorrect: boolean }[] = [];

    for (const answer of answers) {
      // Skip essay answers - they are not auto-graded
      const correctAnswer = correctAnswerMap.get(answer.questionId);
      if (correctAnswer === undefined) {
        // This is an essay question answer, skip grading
        continue;
      }

      const isCorrect =
        answer.selectedOption != null &&
        answer.selectedOption === correctAnswer;

      answerUpdates.push({ id: answer.id, isCorrect });
      if (isCorrect) {
        scoreCorrect++;
      }
    }

    // Unanswered questions count as incorrect (they simply don't add to scoreCorrect)

    // 6. Update is_correct on each answer record
    for (const update of answerUpdates) {
      await this.db
        .update(cbtAnswer)
        .set({ isCorrect: update.isCorrect })
        .where(eq(cbtAnswer.id, update.id));
    }

    // 7. Calculate percentage and store on participant
    // Score is based only on PG questions
    const scorePercentage =
      pgScoreTotal > 0
        ? Math.round((scoreCorrect / pgScoreTotal) * 10000) / 100
        : 0;

    const result: GradingResult = {
      participantId,
      scoreCorrect,
      scoreTotal: pgScoreTotal,
      scorePercentage,
    };

    await this.updateParticipantScore(participantId, result);

    this.checkSla(startTime, participantId);

    this.logger.log(
      `Graded participant ${participantId}: ${scoreCorrect}/${pgScoreTotal} (${scorePercentage}%)`,
    );

    return result;
  }

  /**
   * Update the participant's score fields.
   */
  private async updateParticipantScore(
    participantId: string,
    result: GradingResult,
  ): Promise<void> {
    await this.db
      .update(cbtExamParticipant)
      .set({
        scoreCorrect: result.scoreCorrect,
        scoreTotal: result.scoreTotal,
        scorePercentage: result.scorePercentage.toFixed(2),
      })
      .where(eq(cbtExamParticipant.id, participantId));
  }

  /**
   * Check if grading exceeded the 5-second SLA and log a warning.
   * The grading itself is O(n) and should be well under 5s for any reasonable exam.
   * This is a monitoring safeguard — the caller handles retry if needed.
   */
  private checkSla(startTime: number, participantId: string): void {
    const elapsed = Date.now() - startTime;
    if (elapsed > 5000) {
      this.logger.warn(
        `Grading SLA exceeded for participant ${participantId}: took ${elapsed}ms (threshold: 5000ms)`,
      );
    }
  }
}
