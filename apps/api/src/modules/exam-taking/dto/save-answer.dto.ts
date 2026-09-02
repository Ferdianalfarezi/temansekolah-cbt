import { IsUUID, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class SaveAnswerDto {
  @IsUUID()
  questionId!: string;

  // For pilihan_ganda questions - A/B/C/D/E
  @IsOptional()
  @IsIn(["A", "B", "C", "D", "E"])
  option?: string;

  // For essay questions - free text answer (max 5000 chars)
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: "Jawaban essay maksimal 5000 karakter" })
  essayAnswer?: string;
}
