import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Extracts the authenticated user from the request.
 * Works for both staff (JwtUser) and siswa (SiswaJwtUser) tokens.
 *
 * Usage:
 *   @CurrentUser() user: JwtUser
 *   @CurrentUser('userId') userId: string
 *   @CurrentUser() user: SiswaJwtUser
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
