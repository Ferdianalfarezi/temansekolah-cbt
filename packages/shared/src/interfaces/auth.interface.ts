import { CbtRole } from "../enums";

/**
 * JWT payload for staff users (Admin, Guru, Superadmin).
 * Issued by LMS, validated by CBT using shared secret.
 */
export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * JWT payload for Siswa users.
 * Issued by CBT on /auth/siswa/login.
 */
export interface SiswaJwtPayload {
  siswaAccountId: string;
  tenantId: string;
  role: CbtRole.SISWA;
  iat: number;
  exp: number;
}
