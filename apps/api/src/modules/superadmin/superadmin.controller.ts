import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { CbtRole } from "@cbt/shared";

import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { CurrentUser, Roles } from "../../common/decorators";
import { SuperadminService } from "./superadmin.service";

/**
 * Superadmin Controller — read-only endpoints for cross-tenant access.
 *
 * Only GET endpoints exist. No mutations are allowed.
 * All access is restricted to SUPERADMIN role via guards.
 *
 * Note: TenantGuard is NOT applied here because Superadmin operates
 * across tenants (their JWT has tenantId: null).
 */
@Controller("superadmin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(CbtRole.SUPERADMIN)
export class SuperadminController {
  constructor(private readonly superadminService: SuperadminService) {}

  /**
   * GET /api/superadmin/tenants
   * List all tenants with their CBT status (counts of active PU, sessions, siswa).
   */
  @Get("tenants")
  async listTenants(@CurrentUser("userId") userId: string) {
    return this.superadminService.listTenants(userId);
  }

  /**
   * GET /api/superadmin/tenants/:id/data
   * Read-only view of a tenant's CBT data.
   * Generates audit log and notification to the tenant's Admin_Sekolah.
   */
  @Get("tenants/:id/data")
  async getTenantData(
    @CurrentUser("userId") userId: string,
    @Param("id", ParseUUIDPipe) tenantId: string,
  ) {
    return this.superadminService.getTenantData(tenantId, userId);
  }
}
