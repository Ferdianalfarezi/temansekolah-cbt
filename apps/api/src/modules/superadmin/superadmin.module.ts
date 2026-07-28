import { Module } from "@nestjs/common";
import { SuperadminController } from "./superadmin.controller";
import { SuperadminService } from "./superadmin.service";

/**
 * Superadmin Module — read-only cross-tenant access for Superadmin role.
 *
 * - Only GET endpoints are exposed (enforced at controller level).
 * - All data access is logged to the audit log.
 * - Notifications are generated for tenant admins on every access.
 * - High-priority notifications for sensitive data (Draft/Packaged questions).
 *
 * Dependencies (injected globally):
 * - AuditLogService — for logging all read operations
 * - NotificationService — for notifying tenant admins
 */
@Module({
  controllers: [SuperadminController],
  providers: [SuperadminService],
})
export class SuperadminModule {}
