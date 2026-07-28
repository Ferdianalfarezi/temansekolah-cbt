import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Authentication guard for siswa endpoints.
 * Uses the 'jwt-siswa' strategy to validate siswa-specific tokens.
 */
@Injectable()
export class SiswaAuthGuard extends AuthGuard("jwt-siswa") {}
