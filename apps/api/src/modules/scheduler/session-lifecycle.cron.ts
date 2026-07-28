import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import * as DrizzlePg from "drizzle-orm/node-postgres";
import { and, eq, lte } from "drizzle-orm";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { SchedulerService } from "./scheduler.service";

@Injectable()
export class SessionLifecycleCron implements OnModuleInit {
  private readonly logger = new Logger(SessionLifecycleCron.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzlePg.NodePgDatabase,
    private readonly schedulerService: SchedulerService,
  ) {}

  /**
   * On server startup: re-scan for missed activations.
   * Finds Packaged sessions with past scheduled_at and triggers immediate activation.
   */
  async onModuleInit() {
    this.logger.log("Scanning for missed session activations on startup...");
    await this.recoverMissedActivations();
  }

  /**
   * Every 30 seconds: trigger a completion check for active sessions.
   */
  @Interval(30000)
  async periodicCompletionCheck() {
    await this.schedulerService.triggerCompletionCheck();
  }

  /**
   * Re-scan for sessions that should have been activated while the server was down.
   * Finds all Packaged sessions where scheduled_at <= now and schedules immediate activation.
   */
  private async recoverMissedActivations() {
    const now = new Date();

    const missedSessions = await this.db
      .select({
        id: cbtExamSession.id,
        scheduledAt: cbtExamSession.scheduledAt,
      })
      .from(cbtExamSession)
      .where(
        and(
          eq(cbtExamSession.status, "packaged"),
          lte(cbtExamSession.scheduledAt, now),
        ),
      );

    if (missedSessions.length === 0) {
      this.logger.log("No missed activations found");
      return;
    }

    this.logger.warn(
      `Found ${missedSessions.length} missed session activation(s), scheduling immediately`,
    );

    for (const session of missedSessions) {
      await this.schedulerService.scheduleActivation(
        session.id,
        session.scheduledAt,
      );
    }
  }
}
