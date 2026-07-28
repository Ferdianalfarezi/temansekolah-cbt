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
import { AntiCheatLevel, ResultDetailLevel } from "@/common/enums";

export class CreateExamSessionDto {
  @IsUUID()
  pelaksanaanUjianId!: string;

  @IsUUID()
  mataPelajaranId!: string;

  @IsUUID()
  kelasId!: string;

  @IsUUID()
  proctorId!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsInt()
  @Min(5)
  @Max(360)
  durationMinutes!: number;

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
