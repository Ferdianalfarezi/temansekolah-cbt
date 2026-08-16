import { Module } from "@nestjs/common";
import { ExamTakingController } from "./exam-taking.controller";
import { ExamTakingService } from "./exam-taking.service";
import { SchedulerModule } from "../scheduler/scheduler.module";
import { ProctorGatewayModule } from "../proctor-gateway/proctor-gateway.module";

@Module({
  imports: [SchedulerModule, ProctorGatewayModule],
  controllers: [ExamTakingController],
  providers: [ExamTakingService],
  exports: [ExamTakingService],
})
export class ExamTakingModule {}
