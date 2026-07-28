import {
  IsUUID,
  IsDateString,
  IsInt,
  IsBoolean,
  IsEnum,
  IsOptional,
  Min,
  Max,
} from "class-validator";
import { AntiCheatLevel, ResultDetailLevel } from "@cbt/shared";

export class UpdateExamSessionDto {
  @IsOptional()
  @IsUUID()
  pelaksanaanUjianId?: string;

  @IsOptional()
  @IsUUID()
  mataPelajaranId?: string;

  @IsOptional()
  @IsUUID()
  kelasId?: string;

  @IsOptional()
  @IsUUID()
  proctorId?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(360)
  durationMinutes?: number;

  @IsOptional()
  @IsBoolean()
  randomizeQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  randomizeOptions?: boolean;

  @IsOptional()
  @IsEnum(AntiCheatLevel)
  antiCheatLevel?: AntiCheatLevel;

  @IsOptional()
  @IsEnum(ResultDetailLevel)
  resultDetailLevel?: ResultDetailLevel;
}
