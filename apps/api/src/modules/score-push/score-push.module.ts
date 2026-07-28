import { Global, Module } from "@nestjs/common";
import { ScorePushService } from "./score-push.service";

/**
 * Score Push Module — writes CBT exam scores to the LMS rapor_nilai table.
 *
 * Global module so it can be injected by ExamSessionModule (release-results trigger).
 * Depends on:
 * - DrizzleModule (database access)
 * - AuditLogModule (audit logging)
 */
@Global()
@Module({
  providers: [ScorePushService],
  exports: [ScorePushService],
})
export class ScorePushModule {}
