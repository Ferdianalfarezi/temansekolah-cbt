import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  IsBoolean,
  IsUUID,
  MaxLength,
  Min,
  Max,
} from "class-validator";

/**
 * UpdateBankSoalDto - DTO for updating Bank Soal settings
 *
 * IMPORTANT: mataPelajaranId is intentionally NOT included here.
 * Per requirements, mata pelajaran cannot be changed after creation
 * because it would affect the scope of existing soal.
 */
export class UpdateBankSoalDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nama?: string;

  // mataPelajaranId is NOT updatable per requirements

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  tingkat?: number;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  targetKelasIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(360)
  durasiMenit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  kkm?: number;

  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;
}
