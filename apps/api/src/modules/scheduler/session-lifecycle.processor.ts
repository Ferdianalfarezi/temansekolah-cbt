import { Process, Processor } from "@nestjs/bull";
import { Inject, Logger } from "@nestjs/common";
import * as Bull from "bull";
import * as DrizzlePg from "drizzle-orm/node-postgres";
import { and, eq, lte, inArray, desc, sql } from "drizzle-orm";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { cbtExamParticipant } from "../../drizzle/schema/cbt-exam-participant";
import { cbtAnswerSnapshot } from "../../drizzle/schema/cbt-answer-snapshot";
import { cbtAnswer } from "../../drizzle/schema/cbt-answer";

@Processor("session-lifecycle")
export class SessionLifecycleProcessor {
  private readonly logger = new Logger(SessionLifecycleProcessor.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzlePg.NodePgDatabase) {}

  /**
   * Activate sessions whose scheduled_at time has arrived.
   * Transitions Packaged → Active.
   */
  @Process("activate-session")
  async handleActivateSession(job: Bull.Job<{ sessionId: string }>) {
    const { sessionId } = job.data;
    this.logger.log(`Processing activate-session for session: ${sessionId}`);

    const [session] = await this.db
      .select()
      .from(cbtExamSession)
      .where(eq(cbtExamSession.id, sessionId))
      .limit(1);

    if (!session) {
      this.logger.warn(`Session ${sessionId} not found, skipping activation`);
      return;
    }

    if (session.status !== "packaged") {
      this.logger.warn(
        `Session ${sessionId} is in '${session.status}' state, expected 'packaged'. Skipping.`,
      );
      return;
    }

    // Verify scheduled time has arrived
    if (session.scheduledAt > new Date()) {
      this.logger.warn(
        `Session ${sessionId} scheduled_at is in the future, skipping`,
      );
      return;
    }

    // Transition to active
    await this.db
      .update(cbtExamSession)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(cbtExamSession.id, sessionId));

    this.logger.log(`Session ${sessionId} activated successfully`);

    // TODO (Task 14): Emit Socket.IO event to notify proctor and participants
  }

  /**
   * Auto-submit a participant who has timed out.
   * Gets latest snapshot, saves answers as final, marks as auto_submitted.
   */
  @Process("auto-submit-timeout")
  async handleAutoSubmitTimeout(
    job: Bull.Job<{ participantId: string; examSessionId: string }>,
  ) {
    const { participantId, examSessionId } = job.data;
    this.logger.log(
      `Processing auto-submit-timeout for participant: ${participantId}, session: ${examSessionId}`,
    );

    // Verify participant is still in an active state (not already submitted)
    const [participant] = await this.db
      .select()
      .from(cbtExamParticipant)
      .where(eq(cbtExamParticipant.id, participantId))
      .limit(1);

    if (!participant) {
      this.logger.warn(`Participant ${participantId} not found, skipping`);
      return;
    }

    // Only auto-submit if participant is still "in_progress"
    if (participant.status !== "in_progress") {
      this.logger.log(
        `Participant ${participantId} is already in '${participant.status}' state, skipping auto-submit`,
      );
      return;
    }

    // Get the latest answer snapshot for this participant
    const [latestSnapshot] = await this.db
      .select()
      .from(cbtAnswerSnapshot)
      .where(eq(cbtAnswerSnapshot.participantId, participantId))
      .orderBy(desc(cbtAnswerSnapshot.createdAt))
      .limit(1);

    if (latestSnapshot && latestSnapshot.answers) {
      // Parse snapshot answers and save as final cbt_answer records
      const snapshotAnswers = latestSnapshot.answers as Record<
        string,
        { option?: string; timestamp?: string }
      >;

      for (const [questionId, answerData] of Object.entries(snapshotAnswers)) {
        if (!answerData.option) continue;

        // Upsert answer: insert or update on conflict
        await this.db
          .insert(cbtAnswer)
          .values({
            participantId,
            questionId,
            selectedOption: answerData.option,
            answeredAt: answerData.timestamp
              ? new Date(answerData.timestamp)
              : new Date(),
          })
          .onConflictDoUpdate({
            target: [cbtAnswer.participantId, cbtAnswer.questionId],
            set: {
              selectedOption: answerData.option,
              answeredAt: answerData.timestamp
                ? new Date(answerData.timestamp)
                : new Date(),
            },
          });
      }
    }

    // Mark participant as auto_submitted
    await this.db
      .update(cbtExamParticipant)
      .set({
        status: "auto_submitted",
        submittedAt: new Date(),
        submissionType: "auto_timeout",
        remainingSeconds: 0,
      })
      .where(eq(cbtExamParticipant.id, participantId));

    this.logger.log(`Participant ${participantId} auto-submitted successfully`);

    // TODO (Task 12): Trigger grading service
  }

  /**
   * Periodic check: for each Active session, check if ALL participants
   * are in a terminal state (submitted/auto_submitted) or if max_end_time has passed.
   * If complete → transition session to 'completed'.
   */
  @Process("check-session-completion")
  async handleCheckSessionCompletion(job: Bull.Job) {
    this.logger.debug("Processing check-session-completion");

    // Find all active sessions
    const activeSessions = await this.db
      .select()
      .from(cbtExamSession)
      .where(eq(cbtExamSession.status, "active"));

    for (const session of activeSessions) {
      await this.checkAndCompleteSession(session);
    }

    this.logger.debug(
      `Checked ${activeSessions.length} active sessions for completion`,
    );
  }

  private async checkAndCompleteSession(
    session: typeof cbtExamSession.$inferSelect,
  ) {
    const participants = await this.db
      .select()
      .from(cbtExamParticipant)
      .where(eq(cbtExamParticipant.examSessionId, session.id));

    if (participants.length === 0) {
      // No participants — shouldn't happen, but don't complete empty sessions
      return;
    }

    const terminalStatuses = ["submitted", "auto_submitted"];
    const allTerminal = participants.every((p) =>
      terminalStatuses.includes(p.status),
    );

    // Check if max end time has passed
    // max_end_time = scheduled_at + duration_minutes + max extension (per participant)
    const maxExtensionSeconds = Math.max(
      ...participants.map((p) => p.extensionSeconds || 0),
    );
    const maxEndTime = new Date(
      session.scheduledAt.getTime() +
        session.durationMinutes * 60 * 1000 +
        maxExtensionSeconds * 1000,
    );
    const timeExpired = new Date() > maxEndTime;

    if (allTerminal || timeExpired) {
      await this.db
        .update(cbtExamSession)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(cbtExamSession.id, session.id));

      this.logger.log(
        `Session ${session.id} completed (allTerminal=${allTerminal}, timeExpired=${timeExpired})`,
      );
    }
  }
}
