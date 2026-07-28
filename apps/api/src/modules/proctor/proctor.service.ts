import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, desc, sql } from "drizzle-orm";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { cbtExamParticipant } from "../../drizzle/schema/cbt-exam-participant";
import { cbtSiswaAccount } from "../../drizzle/schema/cbt-siswa-account";
import { cbtViolationEvent } from "../../drizzle/schema/cbt-violation-event";
import { cbtProctorAction } from "../../drizzle/schema/cbt-proctor-action";
import { ExamGateway } from "../proctor-gateway/exam.gateway";
import { HeartbeatService } from "../proctor-gateway/heartbeat.service";
import { AuditLogService } from "../audit-log/audit-log.service";

export interface DashboardParticipant {
  id: string;
  siswaAccountId: string;
  nisn: string;
  status: string;
  startedAt: string | null;
  submittedAt: string | null;
  remainingSeconds: number | null;
  extensionSeconds: number;
  violationCount: number;
  isFlaggedCheating: boolean;
  isEarlySubmission: boolean;
  isConnected: boolean;
}

export interface PostExamReport {
  sessionId: string;
  generatedAt: string;
  summary: {
    totalParticipants: number;
    completed: number;
    inProgress: number;
    earlySubmissions: number;
    flaggedCheating: number;
    totalViolations: number;
    totalProctorActions: number;
  };
  violations: Array<{
    participantId: string;
    nisn: string;
    violationType: string;
    detectedAt: string;
    durationMs: number | null;
  }>;
  proctorActions: Array<{
    participantId: string;
    nisn: string;
    actionType: string;
    extensionMinutes: number | null;
    reason: string;
    createdAt: string;
  }>;
  earlySubmissions: Array<{
    participantId: string;
    nisn: string;
    submittedAt: string | null;
  }>;
}

@Injectable()
export class ProctorService {
  private readonly logger = new Logger(ProctorService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly examGateway: ExamGateway,
    private readonly heartbeatService: HeartbeatService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Get the proctor dashboard for a session — all participants with status,
   * violation count, connection status, and flagged state.
   */
  async getDashboard(
    tenantId: string,
    sessionId: string,
  ): Promise<DashboardParticipant[]> {
    // Validate session belongs to tenant
    await this.validateSessionAccess(tenantId, sessionId);

    // Get all participants with siswa account info
    const participants = await this.db
      .select({
        id: cbtExamParticipant.id,
        siswaAccountId: cbtExamParticipant.siswaAccountId,
        nisn: cbtSiswaAccount.nisn,
        status: cbtExamParticipant.status,
        startedAt: cbtExamParticipant.startedAt,
        submittedAt: cbtExamParticipant.submittedAt,
        remainingSeconds: cbtExamParticipant.remainingSeconds,
        extensionSeconds: cbtExamParticipant.extensionSeconds,
        violationCount: cbtExamParticipant.violationCount,
        isFlaggedCheating: cbtExamParticipant.isFlaggedCheating,
        isEarlySubmission: cbtExamParticipant.isEarlySubmission,
      })
      .from(cbtExamParticipant)
      .innerJoin(
        cbtSiswaAccount,
        eq(cbtExamParticipant.siswaAccountId, cbtSiswaAccount.id),
      )
      .where(eq(cbtExamParticipant.examSessionId, sessionId));

    // Get connected client list for this session
    const connectedClients = this.heartbeatService.getSessionClients(sessionId);
    const connectedParticipantIds = new Set<string>();
    for (const [, entry] of connectedClients) {
      connectedParticipantIds.add(entry.participantId);
    }

    return participants.map((p) => ({
      id: p.id,
      siswaAccountId: p.siswaAccountId,
      nisn: p.nisn,
      status: p.status,
      startedAt: p.startedAt?.toISOString() ?? null,
      submittedAt: p.submittedAt?.toISOString() ?? null,
      remainingSeconds: p.remainingSeconds,
      extensionSeconds: p.extensionSeconds,
      violationCount: p.violationCount,
      isFlaggedCheating: p.isFlaggedCheating,
      isEarlySubmission: p.isEarlySubmission,
      isConnected: connectedParticipantIds.has(p.id),
    }));
  }

  /**
   * Pause a participant's exam timer.
   * Validates participant is in_progress and not already paused.
   */
  async pauseParticipant(
    tenantId: string,
    sessionId: string,
    participantId: string,
    proctorId: string,
    reason: string,
  ): Promise<void> {
    await this.validateSessionAccess(tenantId, sessionId);

    const participant = await this.getParticipantOrFail(
      sessionId,
      participantId,
    );

    if (participant.status !== "in_progress") {
      throw new BadRequestException(
        `Cannot pause participant with status '${participant.status}'. Must be 'in_progress'.`,
      );
    }

    // Update participant: set status to paused, save remaining_seconds
    await this.db
      .update(cbtExamParticipant)
      .set({ status: "paused" })
      .where(eq(cbtExamParticipant.id, participantId));

    // Record proctor action
    await this.db.insert(cbtProctorAction).values({
      examSessionId: sessionId,
      participantId,
      proctorId,
      actionType: "pause",
      reason,
    });

    // Emit timer_paused to siswa client
    this.examGateway.emitToParticipant(participantId, "timer_paused", {
      reason,
      timestamp: new Date().toISOString(),
    });

    // Log to audit
    await this.auditLogService.logWrite(
      { id: proctorId, type: "staff", role: "guru" },
      "update",
      "exam_participant",
      participantId,
      tenantId,
      { status: participant.status },
      { status: "paused" },
      { action: "pause", reason, sessionId },
    );

    this.logger.log(
      `Participant ${participantId} paused by proctor ${proctorId} in session ${sessionId}`,
    );
  }

  /**
   * Resume a paused participant's exam timer.
   */
  async resumeParticipant(
    tenantId: string,
    sessionId: string,
    participantId: string,
    proctorId: string,
    reason: string,
  ): Promise<void> {
    await this.validateSessionAccess(tenantId, sessionId);

    const participant = await this.getParticipantOrFail(
      sessionId,
      participantId,
    );

    if (participant.status !== "paused") {
      throw new BadRequestException(
        `Cannot resume participant with status '${participant.status}'. Must be 'paused'.`,
      );
    }

    // Restore status to in_progress
    await this.db
      .update(cbtExamParticipant)
      .set({ status: "in_progress" })
      .where(eq(cbtExamParticipant.id, participantId));

    // Record proctor action
    await this.db.insert(cbtProctorAction).values({
      examSessionId: sessionId,
      participantId,
      proctorId,
      actionType: "resume",
      reason,
    });

    // Emit timer_resumed to siswa client
    this.examGateway.emitToParticipant(participantId, "timer_resumed", {
      reason,
      timestamp: new Date().toISOString(),
    });

    // Log to audit
    await this.auditLogService.logWrite(
      { id: proctorId, type: "staff", role: "guru" },
      "update",
      "exam_participant",
      participantId,
      tenantId,
      { status: "paused" },
      { status: "in_progress" },
      { action: "resume", reason, sessionId },
    );

    this.logger.log(
      `Participant ${participantId} resumed by proctor ${proctorId} in session ${sessionId}`,
    );
  }

  /**
   * Extend a participant's exam time.
   * Adds minutes*60 to extension_seconds.
   */
  async extendParticipant(
    tenantId: string,
    sessionId: string,
    participantId: string,
    proctorId: string,
    minutes: number,
    reason: string,
  ): Promise<void> {
    await this.validateSessionAccess(tenantId, sessionId);

    const participant = await this.getParticipantOrFail(
      sessionId,
      participantId,
    );

    if (!["in_progress", "paused"].includes(participant.status)) {
      throw new BadRequestException(
        `Cannot extend participant with status '${participant.status}'. Must be 'in_progress' or 'paused'.`,
      );
    }

    const additionalSeconds = minutes * 60;

    // Add to extension_seconds
    await this.db
      .update(cbtExamParticipant)
      .set({
        extensionSeconds: sql`${cbtExamParticipant.extensionSeconds} + ${additionalSeconds}`,
      })
      .where(eq(cbtExamParticipant.id, participantId));

    // Record proctor action
    await this.db.insert(cbtProctorAction).values({
      examSessionId: sessionId,
      participantId,
      proctorId,
      actionType: "extend",
      extensionMinutes: minutes,
      reason,
    });

    // Emit timer_extended to siswa client
    this.examGateway.emitToParticipant(participantId, "timer_extended", {
      additionalSeconds,
      reason,
      timestamp: new Date().toISOString(),
    });

    // Log to audit
    await this.auditLogService.logWrite(
      { id: proctorId, type: "staff", role: "guru" },
      "update",
      "exam_participant",
      participantId,
      tenantId,
      { extensionSeconds: participant.extensionSeconds },
      { extensionSeconds: participant.extensionSeconds + additionalSeconds },
      { action: "extend", minutes, reason, sessionId },
    );

    this.logger.log(
      `Participant ${participantId} extended by ${minutes}min by proctor ${proctorId} in session ${sessionId}`,
    );
  }

  /**
   * Generate a post-exam report for a session.
   * Aggregates violations, proctor actions, early submissions.
   */
  async generatePostExamReport(
    tenantId: string,
    sessionId: string,
  ): Promise<PostExamReport> {
    await this.validateSessionAccess(tenantId, sessionId);

    // Get all participants for this session with siswa info
    const participants = await this.db
      .select({
        id: cbtExamParticipant.id,
        siswaAccountId: cbtExamParticipant.siswaAccountId,
        nisn: cbtSiswaAccount.nisn,
        status: cbtExamParticipant.status,
        submittedAt: cbtExamParticipant.submittedAt,
        violationCount: cbtExamParticipant.violationCount,
        isFlaggedCheating: cbtExamParticipant.isFlaggedCheating,
        isEarlySubmission: cbtExamParticipant.isEarlySubmission,
      })
      .from(cbtExamParticipant)
      .innerJoin(
        cbtSiswaAccount,
        eq(cbtExamParticipant.siswaAccountId, cbtSiswaAccount.id),
      )
      .where(eq(cbtExamParticipant.examSessionId, sessionId));

    // Build participant ID to NISN map
    const participantNisnMap = new Map<string, string>();
    for (const p of participants) {
      participantNisnMap.set(p.id, p.nisn);
    }

    // Get all violations for participants in this session
    const participantIds = participants.map((p) => p.id);

    let violations: Array<{
      participantId: string;
      violationType: string;
      detectedAt: Date;
      durationMs: number | null;
    }> = [];

    if (participantIds.length > 0) {
      violations = await this.db
        .select({
          participantId: cbtViolationEvent.participantId,
          violationType: cbtViolationEvent.violationType,
          detectedAt: cbtViolationEvent.detectedAt,
          durationMs: cbtViolationEvent.durationMs,
        })
        .from(cbtViolationEvent)
        .where(
          sql`${cbtViolationEvent.participantId} IN (${sql.join(
            participantIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
        )
        .orderBy(desc(cbtViolationEvent.detectedAt));
    }

    // Get all proctor actions for this session
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
      .orderBy(desc(cbtProctorAction.createdAt));

    // Compute summary
    const completed = participants.filter(
      (p) => p.status === "submitted" || p.status === "auto_submitted",
    ).length;
    const inProgress = participants.filter(
      (p) => p.status === "in_progress" || p.status === "paused",
    ).length;
    const earlySubmissions = participants.filter(
      (p) => p.isEarlySubmission,
    ).length;
    const flaggedCheating = participants.filter(
      (p) => p.isFlaggedCheating,
    ).length;
    const totalViolations = participants.reduce(
      (sum, p) => sum + p.violationCount,
      0,
    );

    return {
      sessionId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalParticipants: participants.length,
        completed,
        inProgress,
        earlySubmissions,
        flaggedCheating,
        totalViolations,
        totalProctorActions: proctorActions.length,
      },
      violations: violations.map((v) => ({
        participantId: v.participantId,
        nisn: participantNisnMap.get(v.participantId) ?? "unknown",
        violationType: v.violationType,
        detectedAt: v.detectedAt.toISOString(),
        durationMs: v.durationMs,
      })),
      proctorActions: proctorActions.map((a) => ({
        participantId: a.participantId,
        nisn: participantNisnMap.get(a.participantId) ?? "unknown",
        actionType: a.actionType,
        extensionMinutes: a.extensionMinutes,
        reason: a.reason,
        createdAt: a.createdAt.toISOString(),
      })),
      earlySubmissions: participants
        .filter((p) => p.isEarlySubmission)
        .map((p) => ({
          participantId: p.id,
          nisn: p.nisn,
          submittedAt: p.submittedAt?.toISOString() ?? null,
        })),
    };
  }

  /**
   * Validate that the session belongs to the given tenant.
   */
  private async validateSessionAccess(
    tenantId: string,
    sessionId: string,
  ): Promise<void> {
    const [session] = await this.db
      .select({ id: cbtExamSession.id })
      .from(cbtExamSession)
      .where(
        and(
          eq(cbtExamSession.id, sessionId),
          eq(cbtExamSession.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!session) {
      throw new NotFoundException("Exam session not found");
    }
  }

  /**
   * Get a participant by ID within a session, or throw NotFoundException.
   */
  private async getParticipantOrFail(sessionId: string, participantId: string) {
    const [participant] = await this.db
      .select({
        id: cbtExamParticipant.id,
        status: cbtExamParticipant.status,
        remainingSeconds: cbtExamParticipant.remainingSeconds,
        extensionSeconds: cbtExamParticipant.extensionSeconds,
      })
      .from(cbtExamParticipant)
      .where(
        and(
          eq(cbtExamParticipant.id, participantId),
          eq(cbtExamParticipant.examSessionId, sessionId),
        ),
      )
      .limit(1);

    if (!participant) {
      throw new NotFoundException("Participant not found in this session");
    }

    return participant;
  }
}
