import { IsOptional, IsBoolean } from "class-validator";
import { Transform } from "class-transformer";

/**
 * Query params DTO for result export endpoints.
 *
 * Supports:
 * - detail: boolean — Include per-question answer columns and "Kunci Jawaban" sheet
 */
export class ExportQueryDto {
  /**
   * When true, includes detailed per-question answers (Q1, Q2, ... Qn columns)
   * and a "Kunci Jawaban" sheet with answer keys.
   *
   * @example ?detail=true
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  detail?: boolean = false;
}
