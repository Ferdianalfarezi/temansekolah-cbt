import { Module } from "@nestjs/common";
import { CbtConfigController } from "./config.controller";
import { CbtConfigService } from "./config.service";

@Module({
  controllers: [CbtConfigController],
  providers: [CbtConfigService],
  exports: [CbtConfigService],
})
export class CbtConfigModule {}
