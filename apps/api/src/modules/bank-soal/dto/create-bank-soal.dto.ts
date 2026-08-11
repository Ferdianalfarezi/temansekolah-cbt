import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsInt,
  IsArray,
  IsBoolean,
  MaxLength,
  Min,
  Max,
} from "class-validator";

export class CreateBankSoalDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nama!: string;

  @IsUUID()
  mataPelajaranId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  tingkat?: number;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  targetKelasIds?: string[];

  @IsInt()
  @Min(5)
  @Max(360)
  durasiMenit!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  kkm!: number;

  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;
}
