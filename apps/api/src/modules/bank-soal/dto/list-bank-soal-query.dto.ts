import { IsOptional, IsUUID, IsInt, IsString, Min, Max } from "class-validator";
import { Transform } from "class-transformer";

export class ListBankSoalQueryDto {
  @IsOptional()
  @IsUUID()
  mataPelajaranId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Transform(({ value }) => parseInt(value, 10))
  tingkat?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;
}
