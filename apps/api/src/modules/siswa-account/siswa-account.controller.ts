import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import { CbtRole } from "@cbt/shared";

import { JwtAuthGuard, TenantGuard, RolesGuard } from "../../common/guards";
import { Roles, CurrentUser } from "../../common/decorators";
import { SiswaAccountService } from "./siswa-account.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { ListAccountsQueryDto } from "./dto";

@Controller("siswa-accounts")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(CbtRole.ADMIN_SEKOLAH)
export class SiswaAccountController {
  constructor(
    private readonly siswaAccountService: SiswaAccountService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * POST /api/siswa-accounts/sync
   * Manual trigger for siswa account sync (Admin only).
   */
  @Post("sync")
  @HttpCode(HttpStatus.OK)
  async triggerSync(
    @CurrentUser("userId") userId: string,
    @CurrentUser("role") role: string,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId as string;

    const result = await this.siswaAccountService.sync(tenantId, userId);

    // Log manual sync trigger
    await this.auditLogService.logWrite(
      { id: userId, type: "staff", role },
      "update",
      "siswa_account_sync",
      null,
      tenantId,
      null,
      {
        created: result.created,
        nisnUpdated: result.nisnUpdated,
        deactivated: result.deactivated,
        flaggedForReview: result.flaggedForReview,
        errors: result.errors.length,
      },
      { trigger: "manual" },
    );

    return result;
  }

  /**
   * GET /api/siswa-accounts
   * List siswa accounts with pagination and filters (Admin only).
   */
  @Get()
  async listAccounts(@Query() query: ListAccountsQueryDto, @Req() req: any) {
    const tenantId = req.tenantId as string;
    return this.siswaAccountService.listAccounts(tenantId, query);
  }

  /**
   * POST /api/siswa-accounts/:id/reset-password
   * Reset a siswa account password to default (Admin only).
   */
  @Post(":id/reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Param("id") id: string,
    @CurrentUser("userId") userId: string,
    @CurrentUser("role") role: string,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId as string;

    const result = await this.siswaAccountService.resetPassword(id, tenantId);

    if (!result.success) {
      throw new NotFoundException(result.message);
    }

    // Log password reset
    await this.auditLogService.logWrite(
      { id: userId, type: "staff", role },
      "update",
      "siswa_account",
      id,
      tenantId,
      null,
      { action: "password_reset", mustChangePassword: true },
    );

    return result;
  }
}
