import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CbtRole } from "@/common/enums";

import { ROLES_KEY } from "../decorators/roles.decorator";
import { JwtUser } from "../../modules/auth/strategies/jwt.strategy";

/**
 * Guard that checks the authenticated user's CBT role against
 * the roles declared via the @Roles() decorator on the handler.
 *
 * - If no @Roles() metadata is present, access is allowed (no restriction).
 * - If the user's cbtRole is not in the allowed list, access is denied.
 *
 * Must run AFTER JwtAuthGuard (user must be authenticated first).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<CbtRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No roles restriction on this endpoint
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtUser;

    if (!user || !user.cbtRole) {
      throw new ForbiddenException("Authentication required");
    }

    if (!requiredRoles.includes(user.cbtRole)) {
      throw new ForbiddenException(
        "You do not have the required role to access this resource",
      );
    }

    return true;
  }
}
