import { Module } from "@nestjs/common";
import { ExamTakingController } from "./exam-taking.controller";
import { ExamTakingService } from "./exam-taking.service";
import { SchedulerModule } from "../scheduler/scheduler.module";

@Module({
  imports: [SchedulerModule],
  controllers: [ExamTakingController],
  providers: [ExamTakingService],
  exports: [ExamTakingService],
})
export class ExamTakingModule {}
