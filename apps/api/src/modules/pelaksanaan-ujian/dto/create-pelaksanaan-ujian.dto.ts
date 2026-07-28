import { IsUUID, IsIn } from "class-validator";
import { PeriodeRapor } from "@cbt/shared";

export class CreatePelaksanaanUjianDto {
  @IsUUID()
  tahunAjaranId!: string;

  @IsIn([
    PeriodeRapor.UTS_SEMESTER_1,
    PeriodeRapor.SEMESTER_1,
    PeriodeRapor.UTS_SEMESTER_2,
    PeriodeRapor.SEMESTER_2,
  ])
  periodeRapor!: string;

  @IsUUID()
  komponenPenilaianId!: string;
}
