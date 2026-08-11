import {
  IsString,
  IsOptional,
  IsIn,
  MaxLength,
  MinLength,
  ValidateIf,
  IsInt,
  Min,
} from "class-validator";

export class UpdateSoalDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  teksSoal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarSoalUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  opsiA?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarAUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  opsiB?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarBUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  opsiC?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarCUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  opsiD?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarDUrl?: string;

  // opsiE validation: if jawabanBenar is being set to 'E', opsiE must be provided
  @ValidateIf((o) => o.jawabanBenar === "E")
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  opsiE?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarEUrl?: string;

  @IsOptional()
  @IsString()
  @IsIn(["A", "B", "C", "D", "E"])
  jawabanBenar?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  nomorUrut?: number;
}
