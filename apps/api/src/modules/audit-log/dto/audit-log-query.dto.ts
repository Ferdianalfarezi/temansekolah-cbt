import {
  IsOptional,
  IsUUID,
  IsDateString,
  IsString,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * Query params DTO for the Superadmin audit log endpoint.
 * Supports filtering by tenant, actor, time range, resource type, and pagination.
 */
export class AuditLogQueryDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 50;
}
