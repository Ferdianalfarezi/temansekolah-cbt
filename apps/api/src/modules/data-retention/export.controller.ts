import {
  Controller,
  Post,
  Body,
  UseGuards,
  Inject,
  BadRequestException,
} from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, gte, lte, sql } from "drizzle-orm";
import { IsString, IsIn } from "class-validator";
import { CbtRole } from "@cbt/shared";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuditLogService } from "../audit-log/audit-log.service";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { cbtQuestion } from "../../drizzle/schema/cbt-question";
import { cbtExamParticipant } from "../../drizzle/schema/cbt-exam-participant";

class ExportRequestDto {
  @IsIn(["exam_sessions", "questions", "results"])
  resourceType!: "exam_sessions" | "questions" | "results";

  @IsString()
  startDate!: string; // ISO date string

  @IsString()
  endDate!: string; // ISO date string
}

interface ExportResult {
  resourceType: string;
  dateRange: { start: string; end: string };
  recordCount: number;
  data: unknown[];
  exportedAt: string;
}

/**
 * Data Export Controller
 *
 * Provides admin-only export of historical CBT data as JSON.
 * Supports export of exam sessions, questions, and results within a date range.
 */
@Controller("api/export")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExportController {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * POST /api/export
   *
   * Export historical data as JSON.
   * Admin only. Accepts resourceType and dateRange.
   */
  @Post()
  @Roles(CbtRole.ADMIN_SEKOLAH, CbtRole.SUPERADMIN)
  async exportData(
    @Body() dto: ExportRequestDto,
    @CurrentUser() user: { id: string; tenantId: string; role: string },
  ): Promise<ExportResult> {
    const { resourceType, startDate, endDate } = dto;

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException(
        "Invalid date format. Use ISO 8601 date strings.",
      );
    }
    if (start > end) {
      throw new BadRequestException("startDate must be before endDate");
    }

    // Max range: 1 year
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > oneYear) {
      throw new BadRequestException("Date range cannot exceed 1 year");
    }

    let data: unknown[];

    switch (resourceType) {
      case "exam_sessions":
        data = await this.exportExamSessions(user.tenantId, start, end);
        break;
      case "questions":
        data = await this.exportQuestions(user.tenantId, start, end);
        break;
      case "results":
        data = await this.exportResults(user.tenantId, start, end);
        break;
      default:
        data = [];
    }

    // Audit the export action
    await this.auditLogService.log({
      tenantId: user.tenantId,
      actorId: user.id,
      actorType: "staff",
      actorRole: user.role,
      action: "read",
      resourceType: `export_${resourceType}`,
      metadata: {
        startDate,
        endDate,
        recordCount: data.length,
      },
    });

    return {
      resourceType,
      dateRange: { start: startDate, end: endDate },
      recordCount: data.length,
      data,
      exportedAt: new Date().toISOString(),
    };
  }

  private async exportExamSessions(
    tenantId: string,
    start: Date,
    end: Date,
  ): Promise<unknown[]> {
    const results = await this.db
      .select()
      .from(cbtExamSession)
      .where(
        and(
          sql`${cbtExamSession.tenantId} = ${tenantId}`,
          gte(cbtExamSession.createdAt, start),
          lte(cbtExamSession.createdAt, end),
        ),
      );

    return results;
  }

  private async exportQuestions(
    tenantId: string,
    start: Date,
    end: Date,
  ): Promise<unknown[]> {
    const results = await this.db
      .select({
        id: cbtQuestion.id,
        pelaksanaanUjianId: cbtQuestion.pelaksanaanUjianId,
        mataPelajaranId: cbtQuestion.mataPelajaranId,
        tingkat: cbtQuestion.tingkat,
        nomorUrut: cbtQuestion.nomorUrut,
        teksSoal: cbtQuestion.teksSoal,
        opsiA: cbtQuestion.opsiA,
        opsiB: cbtQuestion.opsiB,
        opsiC: cbtQuestion.opsiC,
        opsiD: cbtQuestion.opsiD,
        opsiE: cbtQuestion.opsiE,
        jawabanBenar: cbtQuestion.jawabanBenar,
        createdAt: cbtQuestion.createdAt,
      })
      .from(cbtQuestion)
      .where(
        and(
          sql`${cbtQuestion.tenantId} = ${tenantId}`,
          gte(cbtQuestion.createdAt, start),
          lte(cbtQuestion.createdAt, end),
        ),
      );

    return results;
  }

  private async exportResults(
    tenantId: string,
    start: Date,
    end: Date,
  ): Promise<unknown[]> {
    // Export participant results with scores
    const results = await this.db
      .select({
        participantId: cbtExamParticipant.id,
        examSessionId: cbtExamParticipant.examSessionId,
        siswaAccountId: cbtExamParticipant.siswaAccountId,
        status: cbtExamParticipant.status,
        scoreCorrect: cbtExamParticipant.scoreCorrect,
        scoreTotal: cbtExamParticipant.scoreTotal,
        scorePercentage: cbtExamParticipant.scorePercentage,
        startedAt: cbtExamParticipant.startedAt,
        submittedAt: cbtExamParticipant.submittedAt,
      })
      .from(cbtExamParticipant)
      .innerJoin(
        cbtExamSession,
        sql`${cbtExamParticipant.examSessionId} = ${cbtExamSession.id}`,
      )
      .where(
        and(
          sql`${cbtExamSession.tenantId} = ${tenantId}`,
          gte(cbtExamParticipant.submittedAt, start),
          lte(cbtExamParticipant.submittedAt, end),
        ),
      );

    return results;
  }
}
