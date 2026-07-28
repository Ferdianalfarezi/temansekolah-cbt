import { IsNotEmpty, IsString, MinLength, Matches } from "class-validator";

export class SiswaLoginDto {
  @IsString()
  @IsNotEmpty()
  nisn!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class SiswaChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: "Password baru minimal 6 karakter" })
  newPassword!: string;
}

export class SiswaResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  nisn!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Format tanggal lahir harus YYYY-MM-DD",
  })
  tanggalLahir!: string;
}
