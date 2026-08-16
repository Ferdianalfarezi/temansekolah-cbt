import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { SessionLifecycleProcessor } from "./session-lifecycle.processor";
import { SchedulerService } from "./scheduler.service";
import { SessionLifecycleCron } from "./session-lifecycle.cron";
import { ProctorGatewayModule } from "../proctor-gateway/proctor-gateway.module";

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get<string>("app.redisUrl"),
      }),
    }),
    BullModule.registerQueue({ name: "session-lifecycle" }),
    ScheduleModule.forRoot(),
    ProctorGatewayModule,
  ],
  providers: [
    SessionLifecycleProcessor,
    SchedulerService,
    SessionLifecycleCron,
  ],
  exports: [SchedulerService],
})
export class SchedulerModule {}
