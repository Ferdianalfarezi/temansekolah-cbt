import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { CbtRole } from "@/common/enums";

import { JwtAuthGuard, TenantGuard, RolesGuard } from "../../common/guards";
import { CurrentUser, Roles } from "../../common/decorators";
import { CbtConfigService } from "./config.service";
import { UpdateConfigDto } from "./dto/update-config.dto";

@Controller("config")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(CbtRole.ADMIN_SEKOLAH, CbtRole.GURU)
export class CbtConfigController {
  constructor(private readonly configService: CbtConfigService) {}

  /**
   * GET /api/config
   * Returns the tenant's CBT configuration. Auto-creates with defaults if not exists.
   */
  @Get()
  async getConfig(@CurrentUser("tenantId") tenantId: string) {
    return this.configService.getConfig(tenantId);
  }

  /**
   * PATCH /api/config
   * Updates the tenant's CBT configuration (timezone, anti-cheat defaults, thresholds).
   */
  @Patch()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateConfig(
    @CurrentUser("tenantId") tenantId: string,
    @Body() dto: UpdateConfigDto,
  ) {
    return this.configService.updateConfig(tenantId, dto);
  }
}
