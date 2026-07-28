import { Global, Module } from "@nestjs/common";
import { GradingService } from "./grading.service";

@Global()
@Module({
  providers: [GradingService],
  exports: [GradingService],
})
export class GradingModule {}
