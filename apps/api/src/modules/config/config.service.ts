import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtTenantConfig } from "../../drizzle/schema/cbt-tenant-config";
import { isValidTimezone } from "../../common/helpers/timezone.helper";
import { UpdateConfigDto } from "./dto/update-config.dto";

@Injectable()
export class CbtConfigService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  /**
   * Returns the CBT tenant configuration. If none exists, creates one with defaults.
   */
  async getConfig(tenantId: string) {
    const existing = await this.db
      .select()
      .from(cbtTenantConfig)
      .where(eq(cbtTenantConfig.tenantId, tenantId))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    // Auto-create with defaults
    const inserted = await this.db
      .insert(cbtTenantConfig)
      .values({ tenantId })
      .returning();

    return inserted[0];
  }

  /**
   * Updates the tenant configuration. Validates timezone before persisting.
   */
  async updateConfig(tenantId: string, dto: UpdateConfigDto) {
    // Validate timezone if provided
    if (dto.timezone && !isValidTimezone(dto.timezone)) {
      throw new BadRequestException("Invalid timezone");
    }

    // Ensure config exists first (auto-create if needed)
    await this.getConfig(tenantId);

    const updateData: Record<string, unknown> = {};

    if (dto.timezone !== undefined) {
      updateData.timezone = dto.timezone;
    }
    if (dto.defaultAntiCheatLevel !== undefined) {
      updateData.defaultAntiCheatLevel = dto.defaultAntiCheatLevel;
    }
    if (dto.maxViolationCount !== undefined) {
      updateData.maxViolationCount = dto.maxViolationCount;
    }
    if (dto.earlySubmissionThresholdPct !== undefined) {
      updateData.earlySubmissionThresholdPct = dto.earlySubmissionThresholdPct;
    }
    if (dto.defaultResultDetailLevel !== undefined) {
      updateData.defaultResultDetailLevel = dto.defaultResultDetailLevel;
    }

    if (Object.keys(updateData).length === 0) {
      return this.getConfig(tenantId);
    }

    updateData.updatedAt = new Date();

    const updated = await this.db
      .update(cbtTenantConfig)
      .set(updateData)
      .where(eq(cbtTenantConfig.tenantId, tenantId))
      .returning();

    return updated[0];
  }
}
