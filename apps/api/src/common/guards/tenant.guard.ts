import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { CbtRole } from "@/common/enums";

import { JwtUser } from "../../modules/auth/strategies/jwt.strategy";

/**
 * Guard that extracts tenant_id from the authenticated user's JWT and
 * injects it into the request context.
 *
 * - Superadmin users may have a null tenantId (cross-tenant access).
 * - All other roles MUST have a tenantId; if missing, access is denied.
 *
 * Must run AFTER JwtAuthGuard (user must be authenticated first).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtUser;

    if (!user) {
      throw new ForbiddenException("Authentication required");
    }

    // Superadmin can operate without a tenantId (cross-tenant)
    if (user.cbtRole === CbtRole.SUPERADMIN) {
      request.tenantId = user.tenantId ?? null;
      return true;
    }

    // All other roles must have a valid tenantId
    if (!user.tenantId) {
      throw new ForbiddenException(
        "Tenant context is required for your role. Contact your administrator.",
      );
    }

    request.tenantId = user.tenantId;
    return true;
  }
}
