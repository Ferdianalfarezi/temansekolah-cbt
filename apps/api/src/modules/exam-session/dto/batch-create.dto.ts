import {
  IsUUID,
  IsDateString,
  IsInt,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsArray,
  ArrayMinSize,
  Min,
  Max,
} from "class-validator";
import { AntiCheatLevel, ResultDetailLevel } from "@cbt/shared";

export class BatchCreateExamSessionDto {
  @IsUUID()
  pelaksanaanUjianId!: string;

  @IsUUID()
  mataPelajaranId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  kelasIds!: string[];

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
