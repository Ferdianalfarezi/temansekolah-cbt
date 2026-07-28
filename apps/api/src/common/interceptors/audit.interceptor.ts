import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { Request } from "express";

import { AuditLogService } from "../../modules/audit-log/audit-log.service";
import { JwtUser } from "../../modules/auth/strategies/jwt.strategy";

/**
 * Maps HTTP methods to audit log action names.
 */
const METHOD_ACTION_MAP: Record<string, string> = {
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
};

/**
 * Opt-in interceptor that auto-logs write operations (POST, PUT, PATCH, DELETE).
 * Apply to controllers with @UseInterceptors(AuditInterceptor).
 *
 * Captures:
 * - Actor info from request.user (JwtUser)
 * - Action from HTTP method
 * - Resource type from the controller route path
 * - Metadata: route params and body summary (capped to prevent huge payloads)
 *
 * Does NOT capture "before" values — that requires DB read which is module-specific.
 * Use AuditLogService.logWrite() manually for before/after tracking.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    // Only log write operations
    const action = METHOD_ACTION_MAP[method];
    if (!action) {
      return next.handle();
    }

    const user = (request as any).user as JwtUser | undefined;
    if (!user) {
      return next.handle();
    }

    // Derive resource type from the controller's route path
    const controllerPath =
      Reflect.getMetadata("path", context.getClass()) ?? "";
    const handlerPath = Reflect.getMetadata("path", context.getHandler()) ?? "";
    const resourceType = this.deriveResourceType(controllerPath, handlerPath);

    // Extract resource ID from params if available
    const resourceId = request.params?.id ?? null;

    return next.handle().pipe(
      tap({
        next: () => {
          // Log after successful handler execution (fire-and-forget)
          this.auditLogService
            .log({
              tenantId: user.tenantId ?? null,
              actorId: user.userId,
              actorType: "staff",
              actorRole: user.cbtRole,
              action: action as any,
              resourceType,
              resourceId,
              metadata: {
                method,
                path: request.path,
                params: request.params,
                body: this.summarizeBody(request.body),
              },
            })
            .catch(() => {
              // Swallow — audit failures must not affect the request
            });
        },
      }),
    );
  }

  /**
   * Derives a resource type string from the controller and handler paths.
   * e.g., "config", "exam-sessions", "questions"
   */
  private deriveResourceType(
    controllerPath: string,
    handlerPath: string,
  ): string {
    // Use the controller base path, stripping leading slashes
    const basePath = controllerPath.replace(/^\/+/, "").split("/")[0];
    return basePath || "unknown";
  }

  /**
   * Summarizes the request body to avoid storing huge payloads in audit logs.
   * Keeps top-level keys with truncated values.
   */
  private summarizeBody(body: unknown): Record<string, unknown> | null {
    if (!body || typeof body !== "object") return null;

    const summary: Record<string, unknown> = {};
    const entries = Object.entries(body as Record<string, unknown>);

    for (const [key, value] of entries.slice(0, 20)) {
      if (typeof value === "string" && value.length > 200) {
        summary[key] = value.substring(0, 200) + "...[truncated]";
      } else {
        summary[key] = value;
      }
    }

    return summary;
  }
}
