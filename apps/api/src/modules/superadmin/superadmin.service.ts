import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, sql, and, inArray } from "drizzle-orm";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { tenant } from "../../drizzle/schema/lms-tables";
import { cbtPelaksanaanUjian } from "../../drizzle/schema/cbt-pelaksanaan-ujian";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { cbtSiswaAccount } from "../../drizzle/schema/cbt-siswa-account";
import { cbtTenantConfig } from "../../drizzle/schema/cbt-tenant-config";
import { cbtQuestion } from "../../drizzle/schema/cbt-question";
import { AuditLogService } from "../audit-log/audit-log.service";
import { NotificationService } from "../notification/notification.service";

export interface TenantOverview {
  id: string;
  nama: string;
  isActive: boolean | null;
  cbtStatus: {
    activePelaksanaanUjianCount: number;
    examSessionCount: number;
    siswaAccountCount: number;
  };
}

export interface TenantDataView {
  tenant: { id: string; nama: string };
  config: typeof cbtTenantConfig.$inferSelect | null;
  activePelaksanaanUjian: (typeof cbtPelaksanaanUjian.$inferSelect)[];
  examSessions: {
    id: string;
    status: string;
    scheduledAt: Date;
    durationMinutes: number;
  }[];
  questionCount: number;
}

/**
 * SuperadminService — read-only access to tenant data for Superadmin.
 *
 * Every method:
 * 1. Queries data (READ ONLY — no mutations)
 * 2. Logs the access in the audit log
 * 3. Generates a notification to the tenant's Admin_Sekolah
 *
 * High-priority notifications are generated when accessing sensitive data
 * (e.g., questions in Draft/Packaged exam sessions).
 */
@Injectable()
export class SuperadminService {
  private readonly logger = new Logger(SuperadminService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly auditLogService: AuditLogService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * List all tenants with their CBT status summary.
   * Includes counts of active pelaksanaan ujian, exam sessions, and siswa accounts.
   */
  async listTenants(superadminId: string): Promise<TenantOverview[]> {
    // Get all tenants
    const tenants = await this.db.select().from(tenant);

    if (tenants.length === 0) {
      return [];
    }

    const tenantIds = tenants.map((t) => t.id);

    // Count active pelaksanaan ujian per tenant
    const puCounts = await this.db
      .select({
        tenantId: cbtPelaksanaanUjian.tenantId,
        count: sql<number>`count(*)::int`,
      })
      .from(cbtPelaksanaanUjian)
      .where(
        and(
          inArray(cbtPelaksanaanUjian.tenantId, tenantIds),
          eq(cbtPelaksanaanUjian.isActive, true),
        ),
      )
      .groupBy(cbtPelaksanaanUjian.tenantId);

    // Count exam sessions per tenant
    const sessionCounts = await this.db
      .select({
        tenantId: cbtExamSession.tenantId,
        count: sql<number>`count(*)::int`,
      })
      .from(cbtExamSession)
      .where(inArray(cbtExamSession.tenantId, tenantIds))
      .groupBy(cbtExamSession.tenantId);

    // Count siswa accounts per tenant
    const siswaCounts = await this.db
      .select({
        tenantId: cbtSiswaAccount.tenantId,
        count: sql<number>`count(*)::int`,
      })
      .from(cbtSiswaAccount)
      .where(inArray(cbtSiswaAccount.tenantId, tenantIds))
      .groupBy(cbtSiswaAccount.tenantId);

    // Build lookup maps
    const puMap = new Map(puCounts.map((r) => [r.tenantId, r.count]));
    const sessionMap = new Map(sessionCounts.map((r) => [r.tenantId, r.count]));
    const siswaMap = new Map(siswaCounts.map((r) => [r.tenantId, r.count]));

    const result: TenantOverview[] = tenants.map((t) => ({
      id: t.id,
      nama: t.nama,
      isActive: t.isActive,
      cbtStatus: {
        activePelaksanaanUjianCount: puMap.get(t.id) ?? 0,
        examSessionCount: sessionMap.get(t.id) ?? 0,
        siswaAccountCount: siswaMap.get(t.id) ?? 0,
      },
    }));

    // Audit log the cross-tenant read
    await this.auditLogService.logRead(
      { id: superadminId, type: "staff", role: "superadmin" },
      "tenant_list",
      tenantIds,
      null, // cross-tenant
      { action: "list_tenants", tenantCount: tenants.length },
    );

    return result;
  }

  /**
   * Get detailed read-only view of a specific tenant's CBT data.
   * Logs access and generates notification to tenant's Admin_Sekolah.
   */
  async getTenantData(
    tenantId: string,
    superadminId: string,
  ): Promise<TenantDataView> {
    // Verify tenant exists
    const [tenantRow] = await this.db
      .select({ id: tenant.id, nama: tenant.nama })
      .from(tenant)
      .where(eq(tenant.id, tenantId))
      .limit(1);

    if (!tenantRow) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    // Fetch tenant CBT config
    const [config] = await this.db
      .select()
      .from(cbtTenantConfig)
      .where(eq(cbtTenantConfig.tenantId, tenantId))
      .limit(1);

    // Fetch active pelaksanaan ujian
    const activePU = await this.db
      .select()
      .from(cbtPelaksanaanUjian)
      .where(
        and(
          eq(cbtPelaksanaanUjian.tenantId, tenantId),
          eq(cbtPelaksanaanUjian.isActive, true),
        ),
      );

    // Fetch exam sessions (limited summary)
    const sessions = await this.db
      .select({
        id: cbtExamSession.id,
        status: cbtExamSession.status,
        scheduledAt: cbtExamSession.scheduledAt,
        durationMinutes: cbtExamSession.durationMinutes,
      })
      .from(cbtExamSession)
      .where(eq(cbtExamSession.tenantId, tenantId))
      .limit(50);

    // Count questions
    const [questionCountResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(cbtQuestion)
      .where(eq(cbtQuestion.tenantId, tenantId));

    const questionCount = questionCountResult?.count ?? 0;

    // Determine if high-priority: check if there are questions in Draft/Packaged sessions
    const hasSensitiveData = sessions.some(
      (s) => s.status === "draft" || s.status === "packaged",
    );

    // Audit log
    await this.auditLogService.logRead(
      { id: superadminId, type: "staff", role: "superadmin" },
      "tenant_data",
      [tenantId],
      tenantId,
      {
        action: "get_tenant_data",
        dataAccessed: "config, pelaksanaan_ujian, sessions, question_count",
        hasSensitiveData,
      },
    );

    // Generate notification to Admin_Sekolah
    await this.notificationService.createSuperadminAccessNotification(
      tenantId,
      superadminId,
      "konfigurasi CBT, pelaksanaan ujian, sesi ujian, jumlah soal",
      hasSensitiveData,
    );

    this.logger.log(
      `Superadmin ${superadminId} accessed tenant ${tenantId} data (sensitive: ${hasSensitiveData})`,
    );

    return {
      tenant: tenantRow,
      config: config ?? null,
      activePelaksanaanUjian: activePU,
      examSessions: sessions,
      questionCount,
    };
  }
}
