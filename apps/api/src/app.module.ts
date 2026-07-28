import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TerminusModule } from "@nestjs/terminus";
import { LoggerModule } from "nestjs-pino";
import { AppController } from "./app.controller";
import { envConfig } from "./config/env.config";
import { AuthModule } from "./modules/auth/auth.module";
import { CbtConfigModule } from "./modules/config/config.module";
import { AuditLogModule } from "./modules/audit-log/audit-log.module";
import { SiswaAccountModule } from "./modules/siswa-account/siswa-account.module";
import { DrizzleModule } from "./drizzle/drizzle.module";
import { PelaksanaanUjianModule } from "./modules/pelaksanaan-ujian/pelaksanaan-ujian.module";
import { QuestionModule } from "./modules/question/question.module";
import { ExamSessionModule } from "./modules/exam-session/exam-session.module";
import { SchedulerModule } from "./modules/scheduler/scheduler.module";
import { ExamTakingModule } from "./modules/exam-taking/exam-taking.module";
import { GradingModule } from "./modules/grading/grading.module";
import { ScorePushModule } from "./modules/score-push/score-push.module";
import { ProctorGatewayModule } from "./modules/proctor-gateway/proctor-gateway.module";
import { ProctorModule } from "./modules/proctor/proctor.module";
import { NotificationModule } from "./modules/notification/notification.module";
import { SuperadminModule } from "./modules/superadmin/superadmin.module";
import { DataRetentionModule } from "./modules/data-retention/data-retention.module";

@Module({
  imports: [
    // Configuration with validation
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig],
      envFilePath: [".env"],
    }),

    // Structured JSON logging (pino)
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get("NODE_ENV") === "production";
        let hasPinoPretty = false;
        try {
          require.resolve("pino-pretty");
          hasPinoPretty = true;
        } catch {
          hasPinoPretty = false;
        }

        return {
          pinoHttp: {
            level: isProduction ? "info" : "debug",
            transport:
              !isProduction && hasPinoPretty
                ? {
                    target: "pino-pretty",
                    options: { colorize: true, singleLine: true },
                  }
                : undefined,
            redact: ["req.headers.authorization", "req.headers.cookie"],
            serializers: {
              req: (req: any) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                remoteAddress: req.remoteAddress,
              }),
              res: (res: any) => ({
                statusCode: res.statusCode,
              }),
            },
          },
        };
      },
    }),

    // Health checks
    TerminusModule,

    // Database (Drizzle ORM + pg Pool)
    DrizzleModule,

    // Authentication (shared JWT secret with LMS)
    AuthModule,

    // Audit Log (global — append-only logging for all modules)
    AuditLogModule,

    // CBT Tenant Configuration
    CbtConfigModule,

    // Siswa Account Sync (cron + manual sync from LMS)
    SiswaAccountModule,

    // Pelaksanaan Ujian (exam period management)
    PelaksanaanUjianModule,

    // Question Management (bank soal)
    QuestionModule,

    // Exam Session Management (sesi ujian lifecycle)
    ExamSessionModule,

    // Session Lifecycle Scheduler (Bull Queue — activation, auto-submit, completion)
    SchedulerModule,

    // Exam Taking (Siswa API — start, answer, submit, results)
    ExamTakingModule,

    // Auto-Grading (global — used by ExamTaking and Scheduler)
    GradingModule,

    // Score Push (global — writes CBT scores to LMS rapor_nilai)
    ScorePushModule,

    // WebSocket Gateway (real-time exam monitoring & proctor communication)
    ProctorGatewayModule,

    // Proctor Actions (dashboard, pause/resume/extend, post-exam report)
    ProctorModule,

    // CBT Notifications (global — used by Superadmin and other modules)
    NotificationModule,

    // Superadmin (read-only cross-tenant access with audit + notifications)
    SuperadminModule,

    // Data Retention (snapshot purge, audit log partitioning, data export)
    DataRetentionModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
