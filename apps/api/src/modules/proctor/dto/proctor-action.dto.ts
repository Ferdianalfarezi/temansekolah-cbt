import {
  IsString,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  Max,
} from "class-validator";

export class PauseParticipantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class ResumeParticipantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class ExtendParticipantDto {
  @IsInt()
  @Min(1)
  @Max(60)
  minutes!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
