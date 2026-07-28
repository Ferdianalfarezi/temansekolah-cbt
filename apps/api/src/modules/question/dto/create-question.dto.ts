import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsIn,
  MaxLength,
  MinLength,
  IsInt,
  Min,
  Max,
  ValidateIf,
} from "class-validator";

export class CreateQuestionDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  teksSoal!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  opsiA!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  opsiB!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  opsiC!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  opsiD!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  opsiE?: string;

  @IsNotEmpty()
  @IsIn(["A", "B", "C", "D", "E"])
  jawabanBenar!: string;

  @IsNotEmpty()
  @IsUUID()
  mataPelajaranId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  tingkat?: number;

  @ValidateIf((o) => !o.tingkat)
  @IsUUID()
  kelasId?: string;
}
