import { IsIn } from "class-validator";
import { PeriodeRapor } from "@/common/enums";

export class CreatePelaksanaanUjianDto {
  @IsIn([
    PeriodeRapor.UTS_SEMESTER_1,
    PeriodeRapor.SEMESTER_1,
    PeriodeRapor.UTS_SEMESTER_2,
    PeriodeRapor.SEMESTER_2,
  ])
  periodeRapor!: string;
}
