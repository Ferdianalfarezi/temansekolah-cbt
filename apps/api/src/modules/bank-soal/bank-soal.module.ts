import { Module } from "@nestjs/common";
import { BankSoalService } from "./bank-soal.service";
import { BankSoalController } from "./bank-soal.controller";

@Module({
  controllers: [BankSoalController],
  providers: [BankSoalService],
  exports: [BankSoalService],
})
export class BankSoalModule {}
