import { Module } from "@nestjs/common";
import { ProctorGatewayModule } from "../proctor-gateway/proctor-gateway.module";
import { ProctorController } from "./proctor.controller";
import { ProctorService } from "./proctor.service";

/**
 * Proctor Actions Module.
 *
 * Provides REST endpoints for proctor dashboard, pause/resume/extend actions,
 * and post-exam report generation. Integrates with ExamGateway for real-time
 * communication to siswa clients and AuditLogService for action logging.
 */
@Module({
  imports: [ProctorGatewayModule],
  controllers: [ProctorController],
  providers: [ProctorService],
  exports: [ProctorService],
})
export class ProctorModule {}
