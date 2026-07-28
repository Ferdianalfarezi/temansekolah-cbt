import { IsOptional, IsUUID, IsEnum, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { ExamSessionStatus } from "@cbt/shared";

export class ListSessionsQueryDto {
  @IsOptional()
  @IsEnum(ExamSessionStatus)
  status?: ExamSessionStatus;

  @IsOptional()
  @IsUUID()
  kelasId?: string;

  @IsOptional()
  @IsUUID()
  mataPelajaranId?: string;

  @IsOptional()
  @IsUUID()
  pelaksanaanUjianId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
