import { Module } from "@nestjs/common";
import { PelaksanaanUjianController } from "./pelaksanaan-ujian.controller";
import { PelaksanaanUjianService } from "./pelaksanaan-ujian.service";

@Module({
  controllers: [PelaksanaanUjianController],
  providers: [PelaksanaanUjianService],
  exports: [PelaksanaanUjianService],
})
export class PelaksanaanUjianModule {}
