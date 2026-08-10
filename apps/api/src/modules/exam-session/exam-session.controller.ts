import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { CbtRole } from "@/common/enums";

import { JwtAuthGuard, TenantGuard, RolesGuard } from "../../common/guards";
import { CurrentUser, Roles } from "../../common/decorators";
import { ExamSessionService } from "./exam-session.service";
import { ExamSessionLifecycleService } from "./exam-session-lifecycle.service";
import {
  CreateExamSessionDto,
  BatchCreateExamSessionDto,
  UpdateExamSessionDto,
  ListSessionsQueryDto,
  CancelSessionDto,
} from "./dto";

@Controller("exam-sessions")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(CbtRole.ADMIN_SEKOLAH, CbtRole.GURU)
export class ExamSessionController {
  constructor(
    private readonly examSessionService: ExamSessionService,
    private readonly lifecycleService: ExamSessionLifecycleService,
  ) {}

  /**
   * POST /api/exam-sessions
   * Create a single exam session (draft).
   */
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(
    @CurrentUser("tenantId") tenantId: string,
    @Body() dto: CreateExamSessionDto,
  ) {
    return this.examSessionService.create(tenantId, dto);
  }

  /**
   * POST /api/exam-sessions/batch
   * Batch create sessions for multiple kelas.
   */
  @Post("batch")
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async batchCreate(
    @CurrentUser("tenantId") tenantId: string,
    @Body() dto: BatchCreateExamSessionDto,
  ) {
    return this.examSessionService.batchCreate(tenantId, dto);
  }

  /**
   * GET /api/exam-sessions
   * List exam sessions with optional filters.
   */
  @Get()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async list(
    @CurrentUser("tenantId") tenantId: string,
    @Query() query: ListSessionsQueryDto,
  ) {
    return this.examSessionService.list(tenantId, query);
  }

  /**
   * GET /api/exam-sessions/:id
   * Get exam session detail with participant stats.
   */
  @Get(":id")
  async getById(
    @CurrentUser("tenantId") tenantId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.examSessionService.getById(tenantId, id);
  }

  /**
   * PATCH /api/exam-sessions/:id
   * Update a draft exam session.
   */
  @Patch(":id")
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async update(
    @CurrentUser("tenantId") tenantId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateExamSessionDto,
  ) {
    return this.examSessionService.update(tenantId, id, dto);
  }

  /**
   * POST /api/exam-sessions/:id/package
   * Package a draft session (snapshot questions + assign participants).
   */
  @Post(":id/package")
  async package(
    @CurrentUser("tenantId") tenantId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.lifecycleService.package(tenantId, id);
  }

  /**
   * POST /api/exam-sessions/:id/unpackage
   * Unpackage back to draft (only if scheduled time not passed).
   */
  @Post(":id/unpackage")
  async unpackage(
    @CurrentUser("tenantId") tenantId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.lifecycleService.unpackage(tenantId, id);
  }

  /**
   * POST /api/exam-sessions/:id/cancel
   * Cancel a packaged session.
   */
  @Post(":id/cancel")
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async cancel(
    @CurrentUser("tenantId") tenantId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelSessionDto,
  ) {
    return this.lifecycleService.cancel(tenantId, id, dto.reason);
  }

  /**
   * POST /api/exam-sessions/:id/release-results
   * Release exam results (set results_released=true).
   */
  @Post(":id/release-results")
  async releaseResults(
    @CurrentUser("tenantId") tenantId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.examSessionService.releaseResults(tenantId, id);
  }
}
