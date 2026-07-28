import { Global, Module } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { NotificationController } from "./notification.controller";

/**
 * Notification Module — global module for CBT notifications.
 *
 * - Provides NotificationService to all modules (global export).
 * - Exposes CRUD endpoints for Admin_Sekolah to view/acknowledge notifications.
 * - Used by SuperadminModule to generate notifications on data access.
 */
@Global()
@Module({
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
