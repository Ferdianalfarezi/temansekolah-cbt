import { IsIn } from "class-validator";

/**
 * UpdateBankSoalStatusDto - toggles a Bank Soal between draft and ready ("Siap").
 * Only "ready" bank soal can be scheduled into an exam session.
 */
export class UpdateBankSoalStatusDto {
  @IsIn(["draft", "ready"], {
    message: "Status harus draft atau ready",
  })
  status!: "draft" | "ready";
}
