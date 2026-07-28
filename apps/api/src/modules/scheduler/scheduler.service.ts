import { InjectQueue } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import * as Bull from "bull";

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue("session-lifecycle")
    private readonly sessionQueue: Bull.Queue,
  ) {}

  /**
   * Schedule a session activation at the given time.
   * Creates a delayed job that fires at scheduledAt.
   */
  async scheduleActivation(
    sessionId: string,
    scheduledAt: Date,
  ): Promise<void> {
    const delay = scheduledAt.getTime() - Date.now();

    if (delay <= 0) {
      // If scheduled time is already past, process immediately
      await this.sessionQueue.add(
        "activate-session",
        { sessionId },
        { jobId: `activate-${sessionId}`, removeOnComplete: true },
      );
      this.logger.log(
        `Session ${sessionId} activation scheduled immediately (past due)`,
      );
    } else {
      await this.sessionQueue.add(
        "activate-session",
        { sessionId },
        {
          jobId: `activate-${sessionId}`,
          delay,
          removeOnComplete: true,
        },
      );
      this.logger.log(
        `Session ${sessionId} activation scheduled in ${Math.round(delay / 1000)}s`,
      );
    }
  }

  /**
   * Cancel a previously scheduled activation job.
   * Call this when a session is unpackaged or cancelled.
   */
  async cancelActivation(sessionId: string): Promise<void> {
    const jobId = `activate-${sessionId}`;
    const job = await this.sessionQueue.getJob(jobId);

    if (job) {
      await job.remove();
      this.logger.log(`Cancelled activation job for session ${sessionId}`);
    } else {
      this.logger.debug(
        `No activation job found for session ${sessionId} (may have already fired)`,
      );
    }
  }

  /**
   * Schedule an auto-submit timeout for a specific participant.
   * This starts when a siswa begins the exam and fires after their time expires.
   */
  async scheduleAutoSubmit(
    participantId: string,
    examSessionId: string,
    timeoutMs: number,
  ): Promise<void> {
    await this.sessionQueue.add(
      "auto-submit-timeout",
      { participantId, examSessionId },
      {
        jobId: `auto-submit-${participantId}`,
        delay: timeoutMs,
        removeOnComplete: true,
      },
    );
    this.logger.log(
      `Auto-submit scheduled for participant ${participantId} in ${Math.round(timeoutMs / 1000)}s`,
    );
  }

  /**
   * Cancel a participant's auto-submit timer.
   * Call this when a siswa manually submits before the timeout.
   */
  async cancelAutoSubmit(participantId: string): Promise<void> {
    const jobId = `auto-submit-${participantId}`;
    const job = await this.sessionQueue.getJob(jobId);

    if (job) {
      await job.remove();
      this.logger.log(
        `Cancelled auto-submit job for participant ${participantId}`,
      );
    } else {
      this.logger.debug(
        `No auto-submit job found for participant ${participantId} (may have already fired)`,
      );
    }
  }

  /**
   * Trigger an immediate session completion check.
   * Used by the cron and on-startup recovery.
   */
  async triggerCompletionCheck(): Promise<void> {
    await this.sessionQueue.add(
      "check-session-completion",
      {},
      { removeOnComplete: true },
    );
  }
}
