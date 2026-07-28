import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import { SiswaAuthService } from "./siswa-auth.service";
import {
  SiswaLoginDto,
  SiswaChangePasswordDto,
  SiswaResetPasswordDto,
} from "./dto/siswa-auth.dto";
import { SiswaAuthGuard } from "../../common/guards/siswa-auth.guard";
import type { SiswaJwtUser } from "./strategies/siswa-jwt.strategy";

@Controller("auth/siswa")
export class SiswaAuthController {
  constructor(private readonly siswaAuthService: SiswaAuthService) {}

  /**
   * POST /api/auth/siswa/login
   * Public endpoint — Siswa login with NISN + password.
   */
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: SiswaLoginDto) {
    const account = await this.siswaAuthService.login(dto.nisn, dto.password);
    return this.siswaAuthService.issueToken(account);
  }

  /**
   * POST /api/auth/siswa/change-password
   * Protected — requires siswa JWT. For first-login forced password change.
   */
  @Post("change-password")
  @UseGuards(SiswaAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(@Body() dto: SiswaChangePasswordDto, @Req() req: any) {
    const user = req.user as SiswaJwtUser;
    return this.siswaAuthService.changePassword(
      user.siswaAccountId,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  /**
   * POST /api/auth/siswa/reset-password
   * Public endpoint — Self-reset via NISN + tanggal_lahir verification.
   */
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: SiswaResetPasswordDto) {
    return this.siswaAuthService.resetPassword(dto.nisn, dto.tanggalLahir);
  }
}
