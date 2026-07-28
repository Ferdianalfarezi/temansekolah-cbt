import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { CbtRole } from "@/common/enums";

import { mapLmsRoleToCbt } from "../../../common/helpers/role-mapping";
import { DRIZZLE } from "../../../drizzle/drizzle.module";
import { user } from "../../../drizzle/schema/lms-tables";

/**
 * JWT payload structure issued by the LMS.
 */
export interface StaffJwtPayload {
  sub: string; // user.id
  tenantId: string | null; // null for super_admin
  role:
    | "super_admin"
    | "admin"
    | "kepala_sekolah"
    | "guru"
    | "bendahara"
    | "orang_tua";
  iat: number;
  exp: number;
}

/**
 * Validated user object attached to the request after JWT validation.
 */
export interface JwtUser {
  userId: string;
  tenantId: string | null;
  role: string;
  cbtRole: CbtRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
  ) {
    const secret = configService.get<string>("app.jwtSecret");
    if (!secret) {
      throw new Error("JWT_SECRET environment variable is not configured");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Called after the JWT signature is verified.
   * Maps the LMS payload to the internal user representation.
   * Denies access for roles that have no CBT mapping (bendahara, orang_tua).
   * Checks if the user account is still active in the LMS.
   */
  async validate(payload: StaffJwtPayload): Promise<JwtUser> {
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException("Invalid token payload");
    }

    const cbtRole = mapLmsRoleToCbt(payload.role);
    if (!cbtRole) {
      throw new ForbiddenException(
        "Your role does not have access to the CBT system",
      );
    }

    // Check if the user is still active in the LMS
    const users = await this.db
      .select({ isActive: user.isActive })
      .from(user)
      .where(eq(user.id, payload.sub))
      .limit(1);

    const lmsUser = users[0];
    if (!lmsUser || lmsUser.isActive === false) {
      throw new UnauthorizedException("Account has been deactivated");
    }

    return {
      userId: payload.sub,
      tenantId: payload.tenantId ?? null,
      role: payload.role,
      cbtRole,
    };
  }
}
