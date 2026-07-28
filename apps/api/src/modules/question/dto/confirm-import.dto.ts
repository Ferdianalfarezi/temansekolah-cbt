import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  Max,
  MinLength,
  ValidateNested,
  ValidateIf,
} from "class-validator";

export class ImportQuestionItemDto {
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

  @IsOptional()
  @IsInt()
  @Min(1)
  nomorUrut?: number;
}

export class ConfirmImportDto {
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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportQuestionItemDto)
  questions!: ImportQuestionItemDto[];
}
