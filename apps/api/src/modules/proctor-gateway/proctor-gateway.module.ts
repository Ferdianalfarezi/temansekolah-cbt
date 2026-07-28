import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { ExamGateway } from "./exam.gateway";
import { ProctorGateway } from "./proctor.gateway";
import { HeartbeatService } from "./heartbeat.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("app.jwtSecret"),
      }),
    }),
  ],
  providers: [HeartbeatService, ProctorGateway, ExamGateway],
  exports: [ExamGateway, ProctorGateway, HeartbeatService],
})
export class ProctorGatewayModule {}
