import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateConfigDto {
  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsIn(["standard", "relaxed"])
  defaultAntiCheatLevel?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxViolationCount?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(50)
  earlySubmissionThresholdPct?: number;

  @IsOptional()
  @IsIn(["score_only", "score_with_indicator", "full_detail"])
  defaultResultDetailLevel?: string;
}
