import { Module } from "@nestjs/common";
import { ExamSessionController } from "./exam-session.controller";
import { ExamSessionService } from "./exam-session.service";
import { ExamSessionLifecycleService } from "./exam-session-lifecycle.service";
import { SchedulerModule } from "../scheduler/scheduler.module";

@Module({
  imports: [SchedulerModule],
  controllers: [ExamSessionController],
  providers: [ExamSessionService, ExamSessionLifecycleService],
  exports: [ExamSessionService, ExamSessionLifecycleService],
})
export class ExamSessionModule {}
