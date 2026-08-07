import { Module } from "@nestjs/common";
import { ResultExportService } from "./result-export.service";
import { ResultExportController } from "./result-export.controller";
import { ExportAccessService } from "./export-access.service";

/**
 * Result Export Module
 *
 * Provides Excel export functionality for CBT exam results.
 * Supports both single session export and bulk export for Pelaksanaan Ujian.
 *
 * Dependencies:
 * - DrizzleModule (global) — for database queries
 * - AuditLogModule (global) — for export event logging
 */
@Module({
  controllers: [ResultExportController],
  providers: [ResultExportService, ExportAccessService],
  exports: [ResultExportService, ExportAccessService],
})
export class ResultExportModule {}
