import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";

import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { CurrentUser } from "../../common/decorators";
import { CbtRole, ExamSessionStatus } from "../../common/enums";
import type { JwtUser } from "../auth/strategies/jwt.strategy";
import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { ResultExportService } from "./result-export.service";
import { ExportAccessService } from "./export-access.service";
import { ExportQueryDto } from "./dto/export-query.dto";
import { AuditLogService } from "../audit-log/audit-log.service";

/**
 * Controller for CBT result export endpoints.
 *
 * Provides:
 * - GET /api/exam-sessions/:id/export — Single session export
 * - GET /api/pelaksanaan-ujian/:id/export — Bulk export for Pelaksanaan Ujian
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResultExportController {
  constructor(
    private readonly resultExportService: ResultExportService,
    private readonly exportAccessService: ExportAccessService,
    private readonly auditLogService: AuditLogService,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
  ) {}

  /**
   * GET /api/exam-sessions/:id/export
   *
   * Export exam session results to Excel.
   * Accessible by Admin_Sekolah, assigned Proctor, or Guru with matching jadwal.
   *
   * Access control is handled by ExportAccessService which checks in sequence:
   * 1. Admin_Sekolah - any session in their tenant
   * 2. Proctor - sessions they are assigned to
   * 3. Guru - sessions for their mapel+kelas via jadwal_pelajaran
   *
   * @param id - Exam session ID
   * @param query - Export options (detail=true for per-question answers)
   * @param user - Authenticated user from JWT
   * @param request - Express request for IP extraction
   * @param response - Express response for streaming
   *
   * _Requirements: 2.1, 3.5, 3.6, 3.7, 8.5_
   */
  @Get("exam-sessions/:id/export")
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async exportSession(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: ExportQueryDto,
    @CurrentUser() user: JwtUser,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const { tenantId, userId, cbtRole } = user;

    // Validate tenantId exists (non-superadmin users)
    if (!tenantId) {
      throw new ForbiddenException(
        "Tenant context is required for this operation",
      );
    }

    // 1. Check if session exists and get its status
    const [session] = await this.db
      .select({
        id: cbtExamSession.id,
        status: cbtExamSession.status,
      })
      .from(cbtExamSession)
      .where(
        and(eq(cbtExamSession.id, id), eq(cbtExamSession.tenantId, tenantId)),
      )
      .limit(1);

    // 2. Return 404 if session not found
    if (!session) {
      throw new NotFoundException("Sesi ujian tidak ditemukan");
    }

    // 3. Return 400 if session is not completed
    if (session.status !== ExamSessionStatus.COMPLETED) {
      throw new BadRequestException(
        "Hasil ujian hanya dapat diekspor untuk sesi yang sudah selesai",
      );
    }

    // 4. Check access via ExportAccessService
    // Sequence: Admin_Sekolah first, then Proctor, then Guru
    // Map cbtRole to the role string expected by the access service
    const roleForAccessCheck =
      cbtRole === CbtRole.ADMIN_SEKOLAH ? "admin" : "guru";
    const accessCheck = await this.exportAccessService.checkSessionExportAccess(
      userId,
      roleForAccessCheck,
      tenantId,
      id,
    );

    if (!accessCheck.canAccess) {
      throw new ForbiddenException(
        accessCheck.reason ||
          "Anda tidak memiliki akses untuk mengekspor hasil ujian ini",
      );
    }

    // Determine export type for audit logging
    const exportType = query.detail ? "detail" : "summary";

    // 5. Call ResultExportService.exportSession()
    // The service handles response headers and streaming
    await this.resultExportService.exportSession(
      tenantId,
      id,
      { includeDetailedAnswers: query.detail ?? false },
      response,
    );

    // 6. Log export event to audit log
    // _Requirements: 3.6, 3.7_
    await this.auditLogService.log({
      tenantId,
      actorId: userId,
      actorType: "staff",
      actorRole: cbtRole,
      action: "read",
      resourceType: "exam_session_export",
      resourceId: id,
      metadata: {
        exportType,
        ipAddress: this.extractIpAddress(request),
      },
    });
  }

  /**
   * GET /api/pelaksanaan-ujian/:id/export
   *
   * Bulk export all completed sessions in a Pelaksanaan Ujian.
   * Accessible by Admin_Sekolah only.
   *
   * @param id - Pelaksanaan Ujian ID
   * @param query - Export options (detail=true for per-question answers)
   * @param user - Authenticated user from JWT
   * @param request - Express request for IP extraction
   * @param response - Express response for streaming
   *
   * _Requirements: 5.1, 5.5, 5.6, 5.8_
   */
  @Get("pelaksanaan-ujian/:id/export")
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async exportPelaksanaanUjian(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: ExportQueryDto,
    @CurrentUser() user: JwtUser,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const { tenantId, userId, cbtRole } = user;

    // Validate tenantId exists (non-superadmin users)
    if (!tenantId) {
      throw new ForbiddenException(
        "Tenant context is required for this operation",
      );
    }

    // 1. Check access: Admin_Sekolah only
    // _Requirement: 5.1_
    const accessCheck =
      await this.exportAccessService.checkPelaksanaanUjianExportAccess(
        userId,
        cbtRole === CbtRole.ADMIN_SEKOLAH ? "admin" : "guru",
        tenantId,
      );

    if (!accessCheck.canAccess) {
      throw new ForbiddenException(
        accessCheck.reason ||
          "Hanya Admin Sekolah yang dapat mengekspor hasil secara bulk",
      );
    }

    // 2. Validate Pelaksanaan Ujian exists (404 if not)
    // This will throw NotFoundException if not found
    await this.resultExportService.getPelaksanaanUjianInfo(tenantId, id);

    // 3. Check for completed sessions BEFORE streaming response
    // _Requirement: 5.5_
    const hasCompletedSessions =
      await this.resultExportService.hasCompletedSessions(tenantId, id);

    if (!hasCompletedSessions) {
      throw new BadRequestException(
        "Tidak ada sesi ujian yang selesai dalam pelaksanaan ujian ini",
      );
    }

    // Determine export type for audit logging
    const exportType = query.detail ? "detail" : "summary";

    // 4. Call ResultExportService.exportPelaksanaanUjian()
    // The service handles response headers and streaming
    const sessionCount = await this.resultExportService.exportPelaksanaanUjian(
      tenantId,
      id,
      { includeDetailedAnswers: query.detail ?? false },
      response,
    );

    // 5. Log to audit with session count in metadata
    // _Requirement: 5.8_
    await this.auditLogService.log({
      tenantId,
      actorId: userId,
      actorType: "staff",
      actorRole: cbtRole,
      action: "read",
      resourceType: "pelaksanaan_ujian_export",
      resourceId: id,
      metadata: {
        exportType,
        ipAddress: this.extractIpAddress(request),
        sessionCount,
      },
    });
  }

  /**
   * Extract client IP address from the request.
   *
   * Checks X-Forwarded-For header first (for reverse proxy scenarios),
   * then falls back to req.ip.
   *
   * @param request - Express request object
   * @returns IP address string, or 'unknown' if not available
   *
   * _Requirements: 3.7_
   */
  private extractIpAddress(request: Request): string {
    const forwarded = request.headers["x-forwarded-for"];
    if (forwarded) {
      return (
        forwarded.toString().split(",")[0]?.trim() || request.ip || "unknown"
      );
    }
    return request.ip || "unknown";
  }
}
