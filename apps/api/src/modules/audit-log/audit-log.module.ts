import { Global, Module } from "@nestjs/common";
import { AuditLogService } from "./audit-log.service";
import { AuditLogController } from "./audit-log.controller";

/**
 * Global Audit Log Module.
 *
 * - Exports AuditLogService for all modules to inject (write-only access).
 * - Exposes Superadmin-only query endpoint via AuditLogController.
 * - The audit log is append-only: no update/delete endpoints exist.
 */
@Global()
@Module({
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
