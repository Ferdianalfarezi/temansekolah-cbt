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

export type TipeSoal = "pilihan_ganda" | "essay";

export class CreateSoalDto {
  @IsIn(["pilihan_ganda", "essay"])
  @IsNotEmpty()
  tipeSoal: TipeSoal = "pilihan_ganda";

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(10000) // Increased for HTML content
  teksSoal!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarSoalUrl?: string;

  // PG fields - required only if tipeSoal = 'pilihan_ganda'
  @ValidateIf((o) => o.tipeSoal === "pilihan_ganda")
  @IsString()
  @IsNotEmpty({ message: "Opsi A wajib diisi untuk soal pilihan ganda" })
  @MinLength(1)
  @MaxLength(500)
  opsiA?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarAUrl?: string;

  @ValidateIf((o) => o.tipeSoal === "pilihan_ganda")
  @IsString()
  @IsNotEmpty({ message: "Opsi B wajib diisi untuk soal pilihan ganda" })
  @MinLength(1)
  @MaxLength(500)
  opsiB?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarBUrl?: string;

  @ValidateIf((o) => o.tipeSoal === "pilihan_ganda")
  @IsString()
  @IsNotEmpty({ message: "Opsi C wajib diisi untuk soal pilihan ganda" })
  @MinLength(1)
  @MaxLength(500)
  opsiC?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarCUrl?: string;

  @ValidateIf((o) => o.tipeSoal === "pilihan_ganda")
  @IsString()
  @IsNotEmpty({ message: "Opsi D wajib diisi untuk soal pilihan ganda" })
  @MinLength(1)
  @MaxLength(500)
  opsiD?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarDUrl?: string;

  // opsiE is only required if jawabanBenar is 'E' AND tipeSoal is 'pilihan_ganda'
  @ValidateIf((o) => o.tipeSoal === "pilihan_ganda" && o.jawabanBenar === "E")
  @IsString()
  @IsNotEmpty({ message: "Opsi E wajib diisi jika jawaban benar adalah E" })
  @MinLength(1)
  @MaxLength(500)
  opsiE?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  gambarEUrl?: string;

  // jawabanBenar required only for pilihan_ganda
  @ValidateIf((o) => o.tipeSoal === "pilihan_ganda")
  @IsString()
  @IsNotEmpty({ message: "Jawaban benar wajib diisi untuk soal pilihan ganda" })
  @IsIn(["A", "B", "C", "D", "E"])
  jawabanBenar?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  nomorUrut?: number;
}
