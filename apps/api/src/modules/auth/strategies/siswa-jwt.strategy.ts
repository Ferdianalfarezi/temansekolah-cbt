import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";

import { DRIZZLE } from "../../../drizzle/drizzle.module";
import { cbtSiswaAccount } from "../../../drizzle/schema/cbt-siswa-account";

/**
 * JWT payload structure issued by the CBT system for siswa.
 */
export interface SiswaJwtPayload {
  sub: string; // siswa_account.id
  tenantId: string;
  role: "siswa";
  iat: number;
  exp: number;
}

/**
 * Validated siswa user object attached to the request after JWT validation.
 */
export interface SiswaJwtUser {
  siswaAccountId: string;
  tenantId: string;
  role: "siswa";
}

@Injectable()
export class SiswaJwtStrategy extends PassportStrategy(Strategy, "jwt-siswa") {
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
   * Validates that the token is a siswa token (role === 'siswa').
   * Checks if the siswa account is still active.
   */
  async validate(payload: SiswaJwtPayload): Promise<SiswaJwtUser> {
    if (!payload.sub || !payload.tenantId || payload.role !== "siswa") {
      throw new UnauthorizedException("Invalid siswa token");
    }

    // Check if the siswa account is still active
    const accounts = await this.db
      .select({ isActive: cbtSiswaAccount.isActive })
      .from(cbtSiswaAccount)
      .where(eq(cbtSiswaAccount.id, payload.sub))
      .limit(1);

    const account = accounts[0];
    if (!account || account.isActive === false) {
      throw new UnauthorizedException("Account has been deactivated");
    }

    return {
      siswaAccountId: payload.sub,
      tenantId: payload.tenantId,
      role: "siswa",
    };
  }
}
