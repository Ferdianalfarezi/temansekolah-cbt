import { IsOptional, IsBoolean } from "class-validator";

export class SubmitExamDto {
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}
