import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { AuditLogService } from "../audit-log/audit-log.service";

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ─── Snapshot Purge (Daily at 3 AM) ─────────────────────────────────────────

  /**
   * Purge expired answer snapshots.
   *
   * Policy: DELETE from cbt_answer_snapshot WHERE the associated session has been
   * completed for more than 30 days. Snapshots are only needed for crash recovery
   * during active exams — once the session is completed and graded, they can be removed.
   *
   * Joins through: cbt_answer_snapshot → cbt_exam_participant → cbt_exam_session
   * Condition: cbt_exam_session.completed_at IS NOT NULL
   *            AND cbt_exam_session.completed_at < NOW() - INTERVAL '30 days'
   */
  @Cron("0 3 * * *", { name: "purge-expired-snapshots" })
  async purgeExpiredSnapshots(): Promise<{ deletedCount: number }> {
    this.logger.log("Starting snapshot purge cron job...");

    try {
      const result = await this.db.execute(sql`
        DELETE FROM cbt_answer_snapshot
        WHERE participant_id IN (
          SELECT ep.id
          FROM cbt_exam_participant ep
          INNER JOIN cbt_exam_session es ON ep.exam_session_id = es.id
          WHERE es.completed_at IS NOT NULL
            AND es.completed_at < NOW() - INTERVAL '30 days'
        )
      `);

      const deletedCount =
        typeof result.rowCount === "number" ? result.rowCount : 0;

      this.logger.log(`Snapshot purge complete: ${deletedCount} rows deleted`);

      // Audit log the cleanup operation
      await this.auditLogService.log({
        tenantId: null,
        actorId: "system",
        actorType: "system",
        actorRole: "system",
        action: "delete",
        resourceType: "cbt_answer_snapshot",
        metadata: {
          operation: "purge_expired_snapshots",
          deletedCount,
          retentionDays: 30,
          executedAt: new Date().toISOString(),
        },
      });

      return { deletedCount };
    } catch (error) {
      this.logger.error("Snapshot purge failed", error);
      throw error;
    }
  }

  // ─── Audit Log Partitioning (Monthly Maintenance) ───────────────────────────

  /**
   * Audit log partitioning advisory.
   *
   * PostgreSQL table partitioning (PARTITION BY RANGE) should be configured
   * at the infrastructure level via SQL migrations, not from the application.
   *
   * Recommended partition scheme for cbt_audit_log:
   *
   * ```sql
   * -- Convert to partitioned table (one-time migration):
   * ALTER TABLE cbt_audit_log RENAME TO cbt_audit_log_old;
   *
   * CREATE TABLE cbt_audit_log (
   *   LIKE cbt_audit_log_old INCLUDING ALL
   * ) PARTITION BY RANGE (created_at);
   *
   * -- Monthly partitions (run monthly via pg_cron or external scheduler):
   * CREATE TABLE cbt_audit_log_2024_01
   *   PARTITION OF cbt_audit_log
   *   FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
   *
   * -- Drop old partitions after retention period (e.g., 12 months):
   * DROP TABLE IF EXISTS cbt_audit_log_2023_01;
   * ```
   *
   * This method logs the current partition status for monitoring.
   */
  @Cron("0 4 1 * *", { name: "audit-log-partition-check" })
  async checkAuditLogPartitions(): Promise<void> {
    this.logger.log("Running monthly audit log partition health check...");

    try {
      // Check if partitions exist (informational — no-op if not partitioned yet)
      const result = await this.db.execute(sql`
        SELECT
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
        FROM pg_tables
        WHERE tablename LIKE 'cbt_audit_log%'
        ORDER BY tablename
      `);

      const partitions = result.rows ?? [];

      this.logger.log(
        `Audit log partition check: ${partitions.length} table(s) found`,
      );

      // Log partition status for monitoring
      await this.auditLogService.log({
        tenantId: null,
        actorId: "system",
        actorType: "system",
        actorRole: "system",
        action: "read",
        resourceType: "audit_log_partitions",
        metadata: {
          operation: "partition_health_check",
          partitionCount: partitions.length,
          partitions: partitions.map((p: any) => ({
            name: p.tablename,
            size: p.size,
          })),
          checkedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error("Audit log partition check failed", error);
    }
  }

  // ─── Manual Purge (for admin/testing) ───────────────────────────────────────

  /**
   * Manually purge snapshots older than a specified number of days.
   * Used for admin-triggered cleanup or testing.
   */
  async purgeSnapshotsOlderThan(
    days: number,
  ): Promise<{ deletedCount: number }> {
    const result = await this.db.execute(sql`
      DELETE FROM cbt_answer_snapshot
      WHERE participant_id IN (
        SELECT ep.id
        FROM cbt_exam_participant ep
        INNER JOIN cbt_exam_session es ON ep.exam_session_id = es.id
        WHERE es.completed_at IS NOT NULL
          AND es.completed_at < NOW() - INTERVAL '1 day' * ${days}
      )
    `);

    const deletedCount =
      typeof result.rowCount === "number" ? result.rowCount : 0;

    return { deletedCount };
  }
}
