/**
 * Internal DTO used by services to create audit log entries.
 * Not exposed via HTTP — used programmatically within the application.
 */
export class CreateAuditLogDto {
  tenantId?: string | null;
  actorId!: string;
  actorType!: "staff" | "siswa" | "system";
  actorRole!: string;
  action!: "read" | "create" | "update" | "delete" | "login" | "query";
  resourceType!: string;
  resourceId?: string | null;
  resourceIds?: string[] | null;
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}
