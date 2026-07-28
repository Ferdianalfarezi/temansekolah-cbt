import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import * as bcrypt from "bcrypt";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtSiswaAccount } from "../../drizzle/schema/cbt-siswa-account";
import { siswa } from "../../drizzle/schema/lms-tables";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class SiswaAuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Authenticate siswa by NISN + password.
   * Handles lockout check and failed attempt tracking.
   */
  async login(nisn: string, password: string) {
    // Find active account by NISN (unique per tenant via DB constraint)
    const accounts = await this.db
      .select()
      .from(cbtSiswaAccount)
      .where(
        and(eq(cbtSiswaAccount.nisn, nisn), eq(cbtSiswaAccount.isActive, true)),
      )
      .limit(1);

    const account = accounts[0];
    if (!account) {
      throw new UnauthorizedException("NISN atau password salah");
    }

    // Check lockout
    if (account.lockedUntil && account.lockedUntil > new Date()) {
      const remainingMs = account.lockedUntil.getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      throw new UnauthorizedException(
        `Akun terkunci. Coba lagi dalam ${remainingMinutes} menit`,
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      password,
      account.passwordHash,
    );

    if (!isPasswordValid) {
      const newAttempts = account.failedLoginAttempts + 1;
      const updateData: Record<string, unknown> = {
        failedLoginAttempts: newAttempts,
        updatedAt: new Date(),
      };

      // Lock account if max attempts reached
      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        updateData.lockedUntil = new Date(
          Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000,
        );
      }

      await this.db
        .update(cbtSiswaAccount)
        .set(updateData)
        .where(eq(cbtSiswaAccount.id, account.id));

      throw new UnauthorizedException("NISN atau password salah");
    }

    // Success: reset failed attempts, update last login
    await this.db
      .update(cbtSiswaAccount)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(cbtSiswaAccount.id, account.id));

    return account;
  }

  /**
   * Change password for siswa (first-login forced change or voluntary).
   */
  async changePassword(
    siswaAccountId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const accounts = await this.db
      .select()
      .from(cbtSiswaAccount)
      .where(eq(cbtSiswaAccount.id, siswaAccountId))
      .limit(1);

    const account = accounts[0];
    if (!account) {
      throw new UnauthorizedException("Akun tidak ditemukan");
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, account.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException("Password lama salah");
    }

    // Hash and update new password
    const newHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await this.db
      .update(cbtSiswaAccount)
      .set({
        passwordHash: newHash,
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(cbtSiswaAccount.id, siswaAccountId));

    return { message: "Password berhasil diubah" };
  }

  /**
   * Self-reset password by verifying NISN + tanggal_lahir.
   * Resets password to hash of tanggalLahir in DDMMYYYY format.
   */
  async resetPassword(nisn: string, tanggalLahir: string) {
    // Find account by NISN
    const accounts = await this.db
      .select()
      .from(cbtSiswaAccount)
      .where(
        and(eq(cbtSiswaAccount.nisn, nisn), eq(cbtSiswaAccount.isActive, true)),
      )
      .limit(1);

    const account = accounts[0];
    if (!account) {
      throw new UnauthorizedException("Verifikasi gagal");
    }

    // Verify tanggal_lahir against LMS siswa table
    const siswaRecords = await this.db
      .select({ tanggalLahir: siswa.tanggalLahir })
      .from(siswa)
      .where(eq(siswa.id, account.siswaId))
      .limit(1);

    const siswaRecord = siswaRecords[0];
    if (!siswaRecord || !siswaRecord.tanggalLahir) {
      throw new UnauthorizedException("Verifikasi gagal");
    }

    // Compare tanggal_lahir (DB stores as YYYY-MM-DD string)
    if (siswaRecord.tanggalLahir !== tanggalLahir) {
      throw new UnauthorizedException("Verifikasi gagal");
    }

    // Reset password to tanggalLahir in DDMMYYYY format
    // e.g., "2005-03-15" → "15032005"
    const [year, month, day] = tanggalLahir.split("-");
    const defaultPassword = `${day}${month}${year}`;
    const newHash = await bcrypt.hash(defaultPassword, BCRYPT_SALT_ROUNDS);

    await this.db
      .update(cbtSiswaAccount)
      .set({
        passwordHash: newHash,
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(cbtSiswaAccount.id, account.id));

    return {
      message:
        "Password berhasil direset. Gunakan tanggal lahir (DDMMYYYY) sebagai password baru.",
    };
  }

  /**
   * Issue JWT for authenticated siswa.
   * Payload: { sub: siswaAccountId, tenantId, role: 'siswa' }
   * Validity: 12 hours
   */
  issueToken(account: {
    id: string;
    tenantId: string;
    mustChangePassword: boolean;
  }) {
    const payload = {
      sub: account.id,
      tenantId: account.tenantId,
      role: "siswa",
    };

    const token = this.jwtService.sign(payload, { expiresIn: "12h" });

    return {
      accessToken: token,
      mustChangePassword: account.mustChangePassword,
    };
  }
}
