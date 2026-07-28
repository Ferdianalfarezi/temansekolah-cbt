import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use pino as the application logger (structured JSON in production)
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);

  // Global API prefix — health endpoints excluded
  app.setGlobalPrefix("api", {
    exclude: ["health", "health/live"],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS configuration
  const allowedOrigins = configService.get<string>("CORS_ORIGINS");
  app.enableCors({
    origin: allowedOrigins
      ? allowedOrigins.split(",").map((o) => o.trim())
      : true,
    credentials: true,
  });

  const port = configService.get<number>("PORT", 5003);
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`CBT API running on port ${port}`, "Bootstrap");
}

bootstrap();
