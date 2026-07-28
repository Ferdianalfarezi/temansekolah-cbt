import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { DrizzleModule } from "../../drizzle/drizzle.module";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { DataRetentionService } from "./data-retention.service";
import { ExportController } from "./export.controller";

@Module({
  imports: [ScheduleModule.forRoot(), DrizzleModule, AuditLogModule],
  controllers: [ExportController],
  providers: [DataRetentionService],
  exports: [DataRetentionService],
})
export class DataRetentionModule {}
