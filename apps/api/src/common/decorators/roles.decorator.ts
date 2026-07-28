import { SetMetadata } from "@nestjs/common";
import { CbtRole } from "@cbt/shared";

export const ROLES_KEY = "roles";

/**
 * Decorator that specifies which CBT roles are allowed to access an endpoint.
 * Used in combination with RolesGuard.
 *
 * @example
 * @Roles(CbtRole.ADMIN_SEKOLAH, CbtRole.GURU)
 * @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
 */
export const Roles = (...roles: CbtRole[]) => SetMetadata(ROLES_KEY, roles);
