import {
  Controller,
  Get,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { CbtRole } from "@cbt/shared";

import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { CurrentUser, Roles } from "../../common/decorators";
import { AuditLogService } from "./audit-log.service";
import { AuditLogQueryDto } from "./dto/audit-log-query.dto";

/**
 * Superadmin-only endpoint for querying audit logs.
 * No PATCH or DELETE endpoints exist — the audit log is append-only by design.
 */
@Controller("superadmin/audit-logs")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(CbtRole.SUPERADMIN)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * GET /api/superadmin/audit-logs
   * Query audit logs with filtering: tenantId, actorId, startDate, endDate, resourceType, action.
   * Paginated with max 500 per page.
   * The query itself is logged (audit-the-audit).
   */
  @Get()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async query(
    @Query() queryDto: AuditLogQueryDto,
    @CurrentUser("userId") userId: string,
    @CurrentUser("cbtRole") cbtRole: string,
  ) {
    return this.auditLogService.query(queryDto, {
      id: userId,
      role: cbtRole,
    });
  }
}
