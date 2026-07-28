import { Inject, Injectable, Logger } from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, inArray, like, or, sql, SQL, desc } from "drizzle-orm";
import * as bcrypt from "bcrypt";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtSiswaAccount } from "../../drizzle/schema/cbt-siswa-account";
import { cbtExamParticipant } from "../../drizzle/schema/cbt-exam-participant";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { siswa, tenant } from "../../drizzle/schema/lms-tables";
import { AuditLogService } from "../audit-log/audit-log.service";
import { ListAccountsQueryDto } from "./dto";

export interface SyncResult {
  tenantId: string;
  created: number;
  nisnUpdated: number;
  deactivated: number;
  flaggedForReview: number;
  errors: string[];
}

@Injectable()
export class SiswaAccountService {
  private readonly logger = new Logger(SiswaAccountService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Core sync logic for a single tenant.
   *
   * 1. Query LMS siswa WHERE status='aktif' AND nisn IS NOT NULL AND tenant_id=tenantId
   * 2. Query existing cbt_siswa_account WHERE tenant_id=tenantId
   * 3. Compare by siswa_id:
   *    - New: create account with default password hash
   *    - NISN changed: update nisn
   *    - Status no longer aktif: deactivate + remove from draft/packaged sessions
   *    - NISN became null: set needs_review=true
   */
  async sync(
    tenantId: string,
    actorId: string = "system",
  ): Promise<SyncResult> {
    const result: SyncResult = {
      tenantId,
      created: 0,
      nisnUpdated: 0,
      deactivated: 0,
      flaggedForReview: 0,
      errors: [],
    };

    try {
      // 1. Query all LMS siswa for this tenant (including inactive ones for deactivation check)
      const allLmsSiswa = await this.db
        .select({
          id: siswa.id,
          nisn: siswa.nisn,
          nama: siswa.nama,
          tanggalLahir: siswa.tanggalLahir,
          status: siswa.status,
        })
        .from(siswa)
        .where(eq(siswa.tenantId, tenantId));

      // Active siswa with NISN (eligible for CBT accounts)
      const activeSiswaWithNisn = allLmsSiswa.filter(
        (s) => s.status === "aktif" && s.nisn != null,
      );

      // Active siswa where NISN became null (needs review)
      const activeSiswaNoNisn = allLmsSiswa.filter(
        (s) => s.status === "aktif" && s.nisn == null,
      );

      // Inactive siswa (for deactivation)
      const inactiveSiswa = allLmsSiswa.filter((s) => s.status !== "aktif");

      // 2. Query existing cbt_siswa_account for this tenant
      const existingAccounts = await this.db
        .select()
        .from(cbtSiswaAccount)
        .where(eq(cbtSiswaAccount.tenantId, tenantId));

      const existingBySiswaId = new Map(
        existingAccounts.map((a) => [a.siswaId, a]),
      );

      // 3a. Create new accounts for active siswa with NISN not yet in CBT
      for (const s of activeSiswaWithNisn) {
        const existing = existingBySiswaId.get(s.id);

        if (!existing) {
          // New account — create with default password
          try {
            const defaultPassword = this.formatTanggalLahirPassword(
              s.tanggalLahir,
            );
            const passwordHash = await bcrypt.hash(defaultPassword, 10);

            await this.db.insert(cbtSiswaAccount).values({
              tenantId,
              siswaId: s.id,
              nisn: s.nisn!,
              passwordHash,
              mustChangePassword: true,
              isActive: true,
              needsReview: false,
            });
            result.created++;
          } catch (error: any) {
            result.errors.push(
              `Failed to create account for siswa ${s.id}: ${error.message}`,
            );
            this.logger.error(
              `Failed to create account for siswa ${s.id}`,
              error,
            );
          }
        } else if (existing.nisn !== s.nisn) {
          // 3b. NISN changed — update login identifier
          try {
            await this.db
              .update(cbtSiswaAccount)
              .set({
                nisn: s.nisn!,
                updatedAt: new Date(),
              })
              .where(eq(cbtSiswaAccount.id, existing.id));
            result.nisnUpdated++;
          } catch (error: any) {
            result.errors.push(
              `Failed to update NISN for account ${existing.id}: ${error.message}`,
            );
            this.logger.error(
              `Failed to update NISN for account ${existing.id}`,
              error,
            );
          }
        }
      }

      // 3c. Handle siswa no longer active — deactivate account
      for (const s of inactiveSiswa) {
        const existing = existingBySiswaId.get(s.id);
        if (existing && existing.isActive) {
          try {
            await this.deactivateAccount(existing.id);
            result.deactivated++;
          } catch (error: any) {
            result.errors.push(
              `Failed to deactivate account ${existing.id}: ${error.message}`,
            );
            this.logger.error(
              `Failed to deactivate account ${existing.id}`,
              error,
            );
          }
        }
      }

      // 3d. Handle NISN→null: set needs_review=true (do NOT delete)
      for (const s of activeSiswaNoNisn) {
        const existing = existingBySiswaId.get(s.id);
        if (existing && !existing.needsReview) {
          try {
            await this.db
              .update(cbtSiswaAccount)
              .set({
                needsReview: true,
                updatedAt: new Date(),
              })
              .where(eq(cbtSiswaAccount.id, existing.id));
            result.flaggedForReview++;
          } catch (error: any) {
            result.errors.push(
              `Failed to flag account ${existing.id} for review: ${error.message}`,
            );
            this.logger.error(
              `Failed to flag account ${existing.id} for review`,
              error,
            );
          }
        }
      }
    } catch (error: any) {
      result.errors.push(
        `Sync failed for tenant ${tenantId}: ${error.message}`,
      );
      this.logger.error(`Sync failed for tenant ${tenantId}`, error);
    }

    return result;
  }

  /**
   * Deactivate account and remove from Draft/Packaged sessions.
   */
  private async deactivateAccount(siswaAccountId: string): Promise<void> {
    // Set is_active=false
    await this.db
      .update(cbtSiswaAccount)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(cbtSiswaAccount.id, siswaAccountId));

    // Remove from Draft/Packaged sessions
    const draftOrPackagedSessions = await this.db
      .select({ id: cbtExamSession.id })
      .from(cbtExamSession)
      .where(inArray(cbtExamSession.status, ["draft", "packaged"]));

    if (draftOrPackagedSessions.length > 0) {
      const sessionIds = draftOrPackagedSessions.map((s) => s.id);
      await this.db
        .delete(cbtExamParticipant)
        .where(
          and(
            eq(cbtExamParticipant.siswaAccountId, siswaAccountId),
            inArray(cbtExamParticipant.examSessionId, sessionIds),
          ),
        );
    }
  }

  /**
   * Run sync for all active tenants (used by cron job).
   */
  async syncAllTenants(): Promise<SyncResult[]> {
    const activeTenants = await this.db
      .select({ id: tenant.id })
      .from(tenant)
      .where(eq(tenant.isActive, true));

    const results: SyncResult[] = [];

    for (const t of activeTenants) {
      const result = await this.sync(t.id, "system");
      results.push(result);
    }

    // Log aggregate results
    await this.auditLogService.logWrite(
      { id: "system", type: "system", role: "system" },
      "update",
      "siswa_account_sync",
      null,
      null,
      null,
      {
        tenantCount: results.length,
        totalCreated: results.reduce((sum, r) => sum + r.created, 0),
        totalNisnUpdated: results.reduce((sum, r) => sum + r.nisnUpdated, 0),
        totalDeactivated: results.reduce((sum, r) => sum + r.deactivated, 0),
        totalFlaggedForReview: results.reduce(
          (sum, r) => sum + r.flaggedForReview,
          0,
        ),
        totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      },
    );

    return results;
  }

  /**
   * Paginated list of siswa accounts with optional filters.
   */
  async listAccounts(tenantId: string, filters: ListAccountsQueryDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(cbtSiswaAccount.tenantId, tenantId)];

    if (filters.isActive !== undefined) {
      conditions.push(eq(cbtSiswaAccount.isActive, filters.isActive));
    }
    if (filters.needsReview !== undefined) {
      conditions.push(eq(cbtSiswaAccount.needsReview, filters.needsReview));
    }
    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(like(cbtSiswaAccount.nisn, searchPattern));
    }

    const whereClause = and(...conditions);

    const [countResult, data] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(cbtSiswaAccount)
        .where(whereClause),
      this.db
        .select()
        .from(cbtSiswaAccount)
        .where(whereClause)
        .orderBy(desc(cbtSiswaAccount.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = countResult[0]?.count ?? 0;

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Reset password to default (tanggal_lahir DDMMYYYY) and set must_change_password=true.
   */
  async resetPassword(
    siswaAccountId: string,
    tenantId: string,
  ): Promise<{ success: boolean; message: string }> {
    // Find the account
    const accounts = await this.db
      .select()
      .from(cbtSiswaAccount)
      .where(
        and(
          eq(cbtSiswaAccount.id, siswaAccountId),
          eq(cbtSiswaAccount.tenantId, tenantId),
        ),
      )
      .limit(1);

    const account = accounts[0];
    if (!account) {
      return { success: false, message: "Account not found" };
    }

    // Get siswa's tanggal_lahir from LMS
    const siswaRecords = await this.db
      .select({ tanggalLahir: siswa.tanggalLahir })
      .from(siswa)
      .where(eq(siswa.id, account.siswaId))
      .limit(1);

    const siswaRecord = siswaRecords[0];
    if (!siswaRecord) {
      return { success: false, message: "Siswa record not found in LMS" };
    }

    const defaultPassword = this.formatTanggalLahirPassword(
      siswaRecord.tanggalLahir,
    );
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    await this.db
      .update(cbtSiswaAccount)
      .set({
        passwordHash,
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(cbtSiswaAccount.id, siswaAccountId));

    return { success: true, message: "Password reset to default successfully" };
  }

  /**
   * Format tanggal_lahir to DDMMYYYY string for default password.
   * If tanggalLahir is null/undefined, uses "01012000" as fallback.
   */
  private formatTanggalLahirPassword(tanggalLahir: string | null): string {
    if (!tanggalLahir) {
      return "01012000";
    }

    // tanggalLahir comes as "YYYY-MM-DD" from PostgreSQL date type
    const parts = tanggalLahir.split("-");
    if (parts.length !== 3) {
      return "01012000";
    }

    const [year, month, day] = parts;
    return `${day}${month}${year}`; // DDMMYYYY
  }
}
