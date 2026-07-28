import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, desc, sql, SQL } from "drizzle-orm";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtNotification } from "../../drizzle/schema/cbt-notification";

export interface CreateNotificationOptions {
  isHighPriority?: boolean;
  relatedAuditLogId?: string;
}

export interface NotificationListFilters {
  isRead?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedNotificationResult {
  data: (typeof cbtNotification.$inferSelect)[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * NotificationService — handles creation, listing, and acknowledgment
 * of notifications for Admin_Sekolah.
 *
 * Notifications are generated:
 * - When Superadmin accesses tenant data (via SuperadminService)
 * - Other system events that require admin attention
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  /**
   * Create a notification for a tenant's admin.
   */
  async create(
    tenantId: string,
    title: string,
    body: string,
    options?: CreateNotificationOptions,
  ): Promise<typeof cbtNotification.$inferSelect> {
    const [notification] = await this.db
      .insert(cbtNotification)
      .values({
        tenantId,
        recipientRole: "admin",
        title,
        body,
        isHighPriority: options?.isHighPriority ?? false,
        relatedAuditLogId: options?.relatedAuditLogId ?? null,
      })
      .returning();

    this.logger.log(
      `Notification created for tenant ${tenantId}: "${title}" (priority: ${options?.isHighPriority ?? false})`,
    );

    return notification;
  }

  /**
   * List notifications for a tenant's admin with filters and pagination.
   */
  async list(
    tenantId: string,
    filters: NotificationListFilters,
  ): Promise<PaginatedNotificationResult> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(cbtNotification.tenantId, tenantId)];

    if (filters.isRead !== undefined) {
      conditions.push(eq(cbtNotification.isRead, filters.isRead));
    }

    const whereClause = and(...conditions);

    const [countResult, data] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(cbtNotification)
        .where(whereClause),
      this.db
        .select()
        .from(cbtNotification)
        .where(whereClause)
        .orderBy(desc(cbtNotification.createdAt))
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
   * Acknowledge (mark as read) a specific notification.
   */
  async acknowledge(
    tenantId: string,
    notificationId: string,
  ): Promise<typeof cbtNotification.$inferSelect> {
    const [updated] = await this.db
      .update(cbtNotification)
      .set({
        isRead: true,
        acknowledgedAt: new Date(),
      })
      .where(
        and(
          eq(cbtNotification.id, notificationId),
          eq(cbtNotification.tenantId, tenantId),
        ),
      )
      .returning();

    if (!updated) {
      throw new NotFoundException(
        `Notification ${notificationId} not found for this tenant`,
      );
    }

    return updated;
  }

  /**
   * Helper: Create a notification when Superadmin accesses tenant data.
   * Used by SuperadminService to notify Admin_Sekolah of data access.
   */
  async createSuperadminAccessNotification(
    tenantId: string,
    superadminId: string,
    dataAccessed: string,
    isHighPriority: boolean,
    relatedAuditLogId?: string,
  ): Promise<typeof cbtNotification.$inferSelect> {
    const title = isHighPriority
      ? "⚠️ Akses Data Sensitif oleh Superadmin"
      : "Akses Data oleh Superadmin";

    const body = isHighPriority
      ? `Superadmin (${superadminId}) mengakses data sensitif: ${dataAccessed}. Ini termasuk akses ke soal dalam status Draft/Packaged.`
      : `Superadmin (${superadminId}) mengakses data tenant: ${dataAccessed}.`;

    return this.create(tenantId, title, body, {
      isHighPriority,
      relatedAuditLogId,
    });
  }
}
