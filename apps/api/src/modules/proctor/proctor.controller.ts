import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { CbtRole } from "@/common/enums";

import { JwtAuthGuard, TenantGuard, RolesGuard } from "../../common/guards";
import { CurrentUser, Roles } from "../../common/decorators";
import { ProctorService } from "./proctor.service";
import {
  PauseParticipantDto,
  ResumeParticipantDto,
  ExtendParticipantDto,
} from "./dto";

@Controller("proctor/sessions")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(CbtRole.ADMIN_SEKOLAH, CbtRole.GURU)
export class ProctorController {
  constructor(private readonly proctorService: ProctorService) {}

  /**
   * GET /api/proctor/sessions/:id/dashboard
   * Returns all participants with current status, violation count,
   * connection status, and flagged state.
   */
  @Get(":id/dashboard")
  async getDashboard(
    @CurrentUser("tenantId") tenantId: string,
    @Param("id", ParseUUIDPipe) sessionId: string,
  ) {
    return this.proctorService.getDashboard(tenantId, sessionId);
  }

  /**
   * POST /api/proctor/sessions/:id/participants/:pid/pause
   * Pause a participant's exam timer.
   */
  @Post(":id/participants/:pid/pause")
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async pauseParticipant(
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("userId") proctorId: string,
    @Param("id", ParseUUIDPipe) sessionId: string,
    @Param("pid", ParseUUIDPipe) participantId: string,
    @Body() dto: PauseParticipantDto,
  ) {
    await this.proctorService.pauseParticipant(
      tenantId,
      sessionId,
      participantId,
      proctorId,
      dto.reason,
    );
    return { success: true, message: "Participant paused" };
  }

  /**
   * POST /api/proctor/sessions/:id/participants/:pid/resume
   * Resume a paused participant's exam timer.
   */
  @Post(":id/participants/:pid/resume")
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async resumeParticipant(
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("userId") proctorId: string,
    @Param("id", ParseUUIDPipe) sessionId: string,
    @Param("pid", ParseUUIDPipe) participantId: string,
    @Body() dto: ResumeParticipantDto,
  ) {
    await this.proctorService.resumeParticipant(
      tenantId,
      sessionId,
      participantId,
      proctorId,
      dto.reason,
    );
    return { success: true, message: "Participant resumed" };
  }

  /**
   * POST /api/proctor/sessions/:id/participants/:pid/extend
   * Extend a participant's exam time (1–60 minutes).
   */
  @Post(":id/participants/:pid/extend")
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async extendParticipant(
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("userId") proctorId: string,
    @Param("id", ParseUUIDPipe) sessionId: string,
    @Param("pid", ParseUUIDPipe) participantId: string,
    @Body() dto: ExtendParticipantDto,
  ) {
    await this.proctorService.extendParticipant(
      tenantId,
      sessionId,
      participantId,
      proctorId,
      dto.minutes,
      dto.reason,
    );
    return {
      success: true,
      message: `Participant extended by ${dto.minutes} minutes`,
    };
  }

  /**
   * GET /api/proctor/sessions/:id/report
   * Generate post-exam report with aggregated violations,
   * proctor actions, early submissions.
   */
  @Get(":id/report")
  async getReport(
    @CurrentUser("tenantId") tenantId: string,
    @Param("id", ParseUUIDPipe) sessionId: string,
  ) {
    return this.proctorService.generatePostExamReport(tenantId, sessionId);
  }
}
