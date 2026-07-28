import { Module } from "@nestjs/common";
import { ExamSessionController } from "./exam-session.controller";
import { ExamSessionService } from "./exam-session.service";
import { ExamSessionLifecycleService } from "./exam-session-lifecycle.service";

@Module({
  controllers: [ExamSessionController],
  providers: [ExamSessionService, ExamSessionLifecycleService],
  exports: [ExamSessionService, ExamSessionLifecycleService],
})
export class ExamSessionModule {}
