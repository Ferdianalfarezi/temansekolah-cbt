import {
  IsOptional,
  IsString,
  IsUUID,
  IsIn,
  MaxLength,
  MinLength,
  IsInt,
  Min,
  Max,
} from "class-validator";

/**
 * All fields optional for partial update.
 */
export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  teksSoal?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  opsiA?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  opsiB?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  opsiC?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  opsiD?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  opsiE?: string;

  @IsOptional()
  @IsIn(["A", "B", "C", "D", "E"])
  jawabanBenar?: string;

  @IsOptional()
  @IsUUID()
  mataPelajaranId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  tingkat?: number;

  @IsOptional()
  @IsUUID()
  kelasId?: string;
}
