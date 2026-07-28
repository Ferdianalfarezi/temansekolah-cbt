import { IsUUID, IsIn } from "class-validator";

export class SaveAnswerDto {
  @IsUUID()
  questionId!: string;

  @IsIn(["A", "B", "C", "D", "E"])
  option!: string;
}
