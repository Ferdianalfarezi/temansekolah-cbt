import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { SiswaAccountService } from "./siswa-account.service";
import { SiswaAccountController } from "./siswa-account.controller";
import { SiswaAccountCron } from "./siswa-account.cron";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [SiswaAccountController],
  providers: [SiswaAccountService, SiswaAccountCron],
  exports: [SiswaAccountService],
})
export class SiswaAccountModule {}
