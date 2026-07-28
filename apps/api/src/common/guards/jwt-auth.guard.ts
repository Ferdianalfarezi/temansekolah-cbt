import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Standard JWT authentication guard.
 * Apply to controllers or routes with @UseGuards(JwtAuthGuard).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
