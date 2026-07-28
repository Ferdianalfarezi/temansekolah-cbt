import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CbtRole } from "@cbt/shared";

import { JwtAuthGuard, TenantGuard, RolesGuard } from "../../common/guards";
import { CurrentUser, Roles } from "../../common/decorators";
import { NotificationService } from "./notification.service";

/**
 * Notification Controller — endpoints for Admin_Sekolah to manage notifications.
 *
 * - GET / — list notifications (filtered by isRead, paginated)
 * - PATCH /:id/acknowledge — mark a notification as read
 */
@Controller("notifications")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(CbtRole.ADMIN_SEKOLAH)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /api/notifications
   * List notifications for the authenticated admin's tenant.
   *
   * Query params:
   * - isRead: "true" | "false" (optional)
   * - page: number (default 1)
   * - limit: number (default 20, max 100)
   */
  @Get()
  async list(
    @CurrentUser("tenantId") tenantId: string,
    @Query("isRead") isRead?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.notificationService.list(tenantId, {
      isRead: isRead === "true" ? true : isRead === "false" ? false : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * PATCH /api/notifications/:id/acknowledge
   * Mark a notification as read.
   */
  @Patch(":id/acknowledge")
  async acknowledge(
    @CurrentUser("tenantId") tenantId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.notificationService.acknowledge(tenantId, id);
  }
}
