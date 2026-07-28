import { Inject, Injectable, Logger } from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, gte, lte, desc, sql, SQL } from "drizzle-orm";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtAuditLog } from "../../drizzle/schema/cbt-audit-log";
import { CreateAuditLogDto, AuditLogQueryDto } from "./dto";

export interface PaginatedAuditLogResult {
  data: (typeof cbtAuditLog.$inferSelect)[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * AuditLogService provides write-only audit logging for all modules
 * and query capabilities restricted to Superadmin.
 *
 * The audit log is append-only — no update or delete operations are exposed.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  /**
   * Low-level log method. Inserts a new audit log entry.
   * Used by other modules to record any auditable action.
   */
  async log(entry: CreateAuditLogDto): Promise<void> {
    try {
      await this.db.insert(cbtAuditLog).values({
        tenantId: entry.tenantId ?? null,
        actorId: entry.actorId,
        actorType: entry.actorType,
        actorRole: entry.actorRole,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? null,
        resourceIds: entry.resourceIds ?? null,
        beforeValue: entry.beforeValue ?? null,
        afterValue: entry.afterValue ?? null,
        metadata: entry.metadata ?? null,
      });
    } catch (error) {
      // Audit logging should never crash the main operation
      this.logger.error("Failed to write audit log entry", error);
    }
  }

  /**
   * Helper for logging read-access events (e.g., viewing questions, accessing data).
   */
  async logRead(
    actor: { id: string; type: "staff" | "siswa" | "system"; role: string },
    resourceType: string,
    resourceIds: string[],
    tenantId?: string | null,
    metadata?: Record<string, unknown> | null,
  ): Promise<void> {
    await this.log({
      tenantId: tenantId ?? null,
      actorId: actor.id,
      actorType: actor.type,
      actorRole: actor.role,
      action: "read",
      resourceType,
      resourceId: resourceIds.length === 1 ? resourceIds[0] : null,
      resourceIds: resourceIds.length > 1 ? resourceIds : null,
      metadata: metadata ?? null,
    });
  }

  /**
   * Helper for logging write operations (create, update, delete).
   */
  async logWrite(
    actor: { id: string; type: "staff" | "siswa" | "system"; role: string },
    action: "create" | "update" | "delete",
    resourceType: string,
    resourceId: string | null,
    tenantId?: string | null,
    before?: Record<string, unknown> | null,
    after?: Record<string, unknown> | null,
    metadata?: Record<string, unknown> | null,
  ): Promise<void> {
    await this.log({
      tenantId: tenantId ?? null,
      actorId: actor.id,
      actorType: actor.type,
      actorRole: actor.role,
      action,
      resourceType,
      resourceId: resourceId ?? null,
      beforeValue: before ?? null,
      afterValue: after ?? null,
      metadata: metadata ?? null,
    });
  }

  /**
   * Query audit logs with filtering and pagination (Superadmin only).
   * Implements "audit the audit": the query itself is logged as a new entry.
   *
   * @param filters - Query parameters (tenant, actor, time range, resource type)
   * @param actor - The superadmin making the query (for audit-the-audit)
   */
  async query(
    filters: AuditLogQueryDto,
    actor: { id: string; role: string },
  ): Promise<PaginatedAuditLogResult> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 500);
    const offset = (page - 1) * limit;

    // Build dynamic WHERE conditions
    const conditions: SQL[] = [];

    if (filters.tenantId) {
      conditions.push(eq(cbtAuditLog.tenantId, filters.tenantId));
    }
    if (filters.actorId) {
      conditions.push(eq(cbtAuditLog.actorId, filters.actorId));
    }
    if (filters.startDate) {
      conditions.push(gte(cbtAuditLog.createdAt, new Date(filters.startDate)));
    }
    if (filters.endDate) {
      conditions.push(lte(cbtAuditLog.createdAt, new Date(filters.endDate)));
    }
    if (filters.resourceType) {
      conditions.push(eq(cbtAuditLog.resourceType, filters.resourceType));
    }
    if (filters.action) {
      conditions.push(eq(cbtAuditLog.action, filters.action));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Execute count and data queries
    const [countResult, data] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(cbtAuditLog)
        .where(whereClause),
      this.db
        .select()
        .from(cbtAuditLog)
        .where(whereClause)
        .orderBy(desc(cbtAuditLog.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = countResult[0]?.count ?? 0;

    // "Audit the audit": log the Superadmin query itself
    await this.log({
      tenantId: null, // cross-tenant query
      actorId: actor.id,
      actorType: "staff",
      actorRole: actor.role,
      action: "query",
      resourceType: "audit_log",
      metadata: {
        filters: {
          tenantId: filters.tenantId,
          actorId: filters.actorId,
          startDate: filters.startDate,
          endDate: filters.endDate,
          resourceType: filters.resourceType,
          action: filters.action,
          page,
          limit,
        },
        resultCount: data.length,
      },
    });

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
}
