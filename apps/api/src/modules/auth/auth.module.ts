import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { SiswaJwtStrategy } from "./strategies/siswa-jwt.strategy";
import { SiswaAuthService } from "./siswa-auth.service";
import { SiswaAuthController } from "./siswa-auth.controller";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("app.jwtSecret"),
        signOptions: {
          expiresIn: configService.get<string>("app.jwtExpiresIn", "12h"),
        },
      }),
    }),
  ],
  controllers: [SiswaAuthController],
  providers: [JwtStrategy, SiswaJwtStrategy, SiswaAuthService],
  exports: [PassportModule, JwtModule, SiswaAuthService],
})
export class AuthModule {}
