import { Inject, Injectable, Logger } from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { cbtPelaksanaanUjian } from "../../drizzle/schema/cbt-pelaksanaan-ujian";
import { jadwalPelajaran } from "../../drizzle/schema/lms-tables";

/**
 * Access check result returned by ExportAccessService methods.
 *
 * _Requirements: 3.1, 3.2, 3.3, 3.4_
 */
export interface ExportAccessCheck {
  /** Whether access is granted */
  canAccess: boolean;
  /** The path through which access was granted, null if denied */
  accessPath: "admin" | "proctor" | "guru" | null;
  /** Human-readable reason for the decision (useful for debugging/audit) */
  reason?: string;
}

/**
 * ExportAccessService provides access control logic for result export operations.
 *
 * Access is checked in sequence as per requirements:
 * 1. Admin_Sekolah: Can access any session within their tenant
 * 2. Proctor: Can only access sessions they are assigned to
 * 3. Guru: Can access sessions for their mapel+kelas (via jadwal_pelajaran)
 *
 * _Requirements: 3.1, 3.2, 3.3, 3.4_
 */
@Injectable()
export class ExportAccessService {
  private readonly logger = new Logger(ExportAccessService.name);

  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  /**
   * Check if a user has access to export results for a specific exam session.
   *
   * Both Admin_Sekolah and Guru have full access to any session in their tenant.
   * Simplified role model - no distinction between admin and guru for access control.
   *
   * @param userId - The ID of the user requesting access
   * @param userRole - The role of the user (admin, guru, etc.)
   * @param tenantId - The tenant ID the user belongs to
   * @param sessionId - The exam session ID to check access for
   * @returns ExportAccessCheck with canAccess, accessPath, and reason
   */
  async checkSessionExportAccess(
    userId: string,
    userRole: string,
    tenantId: string,
    sessionId: string,
  ): Promise<ExportAccessCheck> {
    // First, load the session to verify it exists in this tenant
    const sessionData = await this.getSessionWithPelaksanaanUjian(
      tenantId,
      sessionId,
    );

    // Session not found in this tenant - deny access
    if (!sessionData) {
      return {
        canAccess: false,
        accessPath: null,
        reason: "Sesi ujian tidak ditemukan atau bukan milik tenant ini",
      };
    }

    // Both admin and guru have full access to any session in their tenant
    if (userRole === "admin" || userRole === "guru") {
      this.logger.debug(
        `User ${userId} (role: ${userRole}) granted access to session ${sessionId}`,
      );
      return {
        canAccess: true,
        accessPath: "admin",
        reason: "Staff has access to all sessions in tenant",
      };
    }

    // No valid access path found
    this.logger.debug(
      `Access denied for user ${userId} (role: ${userRole}) to session ${sessionId}`,
    );
    return {
      canAccess: false,
      accessPath: null,
      reason: "Anda tidak memiliki akses untuk mengekspor hasil ujian ini",
    };
  }

  /**
   * Check if a user has access to export results for a Pelaksanaan Ujian.
   *
   * Both Admin_Sekolah and Guru can access bulk exports.
   *
   * @param userId - The ID of the user requesting access
   * @param userRole - The role of the user
   * @param tenantId - The tenant ID the user belongs to
   * @returns ExportAccessCheck with canAccess, accessPath, and reason
   */
  async checkPelaksanaanUjianExportAccess(
    userId: string,
    userRole: string,
    tenantId: string,
  ): Promise<ExportAccessCheck> {
    // Both admin and guru can access bulk exports
    if (userRole === "admin" || userRole === "guru") {
      this.logger.debug(
        `User ${userId} (role: ${userRole}) granted bulk export access in tenant ${tenantId}`,
      );
      return {
        canAccess: true,
        accessPath: "admin",
        reason: "Staff can access bulk exports for any Pelaksanaan Ujian",
      };
    }

    return {
      canAccess: false,
      accessPath: null,
      reason: "Anda tidak memiliki akses untuk mengekspor hasil ini",
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Load session data along with tahunAjaranId from pelaksanaan_ujian.
   * Returns null if session not found in the specified tenant.
   */
  private async getSessionWithPelaksanaanUjian(
    tenantId: string,
    sessionId: string,
  ): Promise<{
    id: string;
    proctorId: string;
    mataPelajaranId: string;
    kelasId: string;
    tahunAjaranId: string;
  } | null> {
    const [result] = await this.db
      .select({
        id: cbtExamSession.id,
        proctorId: cbtExamSession.proctorId,
        mataPelajaranId: cbtExamSession.mataPelajaranId,
        kelasId: cbtExamSession.kelasId,
        tahunAjaranId: cbtPelaksanaanUjian.tahunAjaranId,
      })
      .from(cbtExamSession)
      .innerJoin(
        cbtPelaksanaanUjian,
        eq(cbtExamSession.pelaksanaanUjianId, cbtPelaksanaanUjian.id),
      )
      .where(
        and(
          eq(cbtExamSession.id, sessionId),
          eq(cbtExamSession.tenantId, tenantId),
        ),
      )
      .limit(1);

    return result ?? null;
  }

  /**
   * Check if a Guru has jadwal_pelajaran matching the session's mapel, kelas, and tahun ajaran.
   *
   * A Guru can access export if they have at least one jadwal_pelajaran entry
   * with matching:
   * - tenantId
   * - guruId (must be the requesting user)
   * - mataPelajaranId
   * - kelasId
   * - tahunAjaranId
   *
   * @returns true if matching jadwal exists, false otherwise
   *
   * _Requirement: 3.3_
   */
  private async checkGuruJadwalAccess(
    guruId: string,
    tenantId: string,
    mataPelajaranId: string,
    kelasId: string,
    tahunAjaranId: string,
  ): Promise<boolean> {
    const [result] = await this.db
      .select({ id: jadwalPelajaran.id })
      .from(jadwalPelajaran)
      .where(
        and(
          eq(jadwalPelajaran.tenantId, tenantId),
          eq(jadwalPelajaran.guruId, guruId),
          eq(jadwalPelajaran.mataPelajaranId, mataPelajaranId),
          eq(jadwalPelajaran.kelasId, kelasId),
          eq(jadwalPelajaran.tahunAjaranId, tahunAjaranId),
        ),
      )
      .limit(1);

    return result !== undefined;
  }
}
