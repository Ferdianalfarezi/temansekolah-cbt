import { IsOptional, IsUUID, IsInt, Min, Max, IsString } from "class-validator";
import { Type } from "class-transformer";

export class ListQuestionsQueryDto {
  @IsOptional()
  @IsUUID()
  mataPelajaranId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  tingkat?: number;

  @IsOptional()
  @IsUUID()
  kelasId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
