import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  MaxLength,
  MinLength,
  ValidateIf,
  IsInt,
  Min,
} from "class-validator";

export class CreateSoalDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(2000)
  teksSoal!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarSoalUrl?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  opsiA!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarAUrl?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  opsiB!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarBUrl?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  opsiC!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarCUrl?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  opsiD!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarDUrl?: string;

  // opsiE is only required if jawabanBenar is 'E'
  @ValidateIf((o) => o.jawabanBenar === "E")
  @IsString()
  @IsNotEmpty({ message: "Opsi E wajib diisi jika jawaban benar adalah E" })
  @MinLength(1)
  @MaxLength(500)
  opsiE?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarEUrl?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(["A", "B", "C", "D", "E"])
  jawabanBenar!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  nomorUrut?: number;
}
