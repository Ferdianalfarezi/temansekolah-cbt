import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Logger } from "nestjs-pino";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { join } from "path";
import { AppModule } from "./app.module";

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("DATABASE_URL not set — skipping migrations");
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  try {
    console.log("🔄 Running CBT database migrations...");
    await migrate(db, {
      migrationsFolder: join(__dirname, "../drizzle/migrations"),
    });
    console.log("✅ CBT migrations completed");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function bootstrap() {
  // Run migrations before starting the app (only in production)
  if (process.env.NODE_ENV === "production") {
    await runMigrations();
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);

  app.setGlobalPrefix("api", {
    exclude: ["health", "health/live"],
  });

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
