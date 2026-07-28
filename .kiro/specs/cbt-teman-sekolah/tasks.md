# Implementation Plan

## Overview

CBT Teman Sekolah implementation — a multi-tenant Computer-Based Testing platform. This plan covers the full build from scaffolding through deployment. Tasks 1–3 establish the foundation (monorepo, database, auth).

## Tasks

- [x] 1. Project Scaffolding & Monorepo Setup
  - [x] 1.1. Initialize pnpm workspace monorepo structure with `apps/api`, `apps/admin`, `apps/siswa`, `packages/shared`
  - [x] 1.2. Configure TypeScript base config (`tsconfig.json`) with path aliases
  - [x] 1.3. Setup NestJS 10 project in `apps/api` with Drizzle ORM, Passport JWT, Socket.IO, Bull queue, pino logger
  - [x] 1.4. Setup Vue 3 + Vite project in `apps/admin` with TailwindCSS, Pinia, Vue Router
  - [x] 1.5. Setup React 18 + Vite project in `apps/siswa` with TailwindCSS and Workbox PWA plugin
  - [x] 1.6. Setup `packages/shared` with CBT enums (`CbtRole`, `ExamSessionStatus`, `ParticipantStatus`, `ViolationType`, `AntiCheatLevel`, `ResultDetailLevel`) and shared interfaces
  - [x] 1.7. Configure ESLint, Prettier, and common dev scripts in root `package.json`
  - [x] 1.8. Create `.env.example` with required environment variables (DB_URL, REDIS_URL, JWT_SECRET, S3_BUCKET, etc.)
  - [x] 1.9. Add Docker compose file for local PostgreSQL + Redis

- [x] 2. Database Schema & Migrations
  - [x] 2.1. Create Drizzle schema files for all CBT tables: `cbt_tenant_config`, `cbt_pelaksanaan_ujian`, `cbt_question`, `cbt_exam_session`, `cbt_exam_session_question`, `cbt_siswa_account`, `cbt_exam_participant`, `cbt_answer`, `cbt_answer_snapshot`, `cbt_violation_event`, `cbt_proctor_action`, `cbt_audit_log`, `cbt_notification`
  - [x] 2.2. Create enum types: `cbt_exam_session_status`, `cbt_anti_cheat_level`, `cbt_result_detail_level`, `cbt_participant_status`
  - [x] 2.3. Add all indexes, unique constraints, and check constraints as defined in design.md
  - [x] 2.4. Create partial unique index for `cbt_pelaksanaan_ujian` (one active per tenant)
  - [x] 2.5. Generate and verify initial migration
  - [x] 2.6. Create seed script with sample tenant config, pelaksanaan ujian, questions, and exam session for development
  - [x] 2.7. Define Drizzle schema references for LMS tables (user, siswa, kelas, mata_pelajaran, jadwal_pelajaran, tahun_ajaran, tenant, komponen_penilaian, rapor, rapor_nilai) as read-only references

- [x] 3. Authentication & Authorization Module
  - [x] 3.1. Implement staff JWT validation guard (shared secret with LMS — validates tokens issued by LMS)
  - [x] 3.2. Implement role mapping: LMS `super_admin` → Superadmin, `admin`/`kepala_sekolah` → Admin_Sekolah, `guru` → Guru
  - [x] 3.3. Implement deny for unmapped roles (`bendahara`, `orang_tua`) with clear error message
  - [x] 3.4. Implement `TenantGuard` that extracts `tenant_id` from JWT and injects into request context
  - [x] 3.5. Implement `RolesGuard` decorator (`@Roles('admin', 'guru')`) for endpoint-level access control
  - [x] 3.6. Implement Siswa login endpoint (`POST /api/auth/siswa/login`) — NISN + password, BCrypt verify
  - [x] 3.7. Implement Siswa first-login forced password change (`POST /api/auth/siswa/change-password`)
  - [x] 3.8. Implement Siswa self-reset (`POST /api/auth/siswa/reset-password`) — verify NISN + tanggal_lahir
  - [x] 3.9. Implement account lockout (5 failed attempts → 15 min lock)
  - [x] 3.10. Implement Siswa JWT issuance (12hr validity, payload: siswaAccountId, tenantId, role)
  - [x] 3.11. Implement `@CurrentUser()` decorator for both staff and siswa
  - [x] 3.12. Implement LMS user deactivation check (is_active=false → deny on next auth)

- [x] 4. Tenant Configuration Module <!--optional-->
  - [x] 4.1. Create `CbtConfigModule` with controller and service
  - [x] 4.2. Implement `GET /api/config` — return tenant's CBT config (auto-create with defaults if not exists)
  - [x] 4.3. Implement `PATCH /api/config` — update timezone, anti-cheat defaults, thresholds (Admin only)
  - [x] 4.4. Add validation: timezone must be valid IANA timezone, thresholds within defined ranges
  - [x] 4.5. Implement timezone helper utility used across all modules for scheduling/display

- [x] 5. Audit Log Module <!--optional-->
  - [x] 5.1. Create `AuditLogModule` with service (write-only for most modules, query for Superadmin)
  - [x] 5.2. Implement `AuditInterceptor` that auto-logs write operations with before/after values
  - [x] 5.3. Implement manual audit log helper for read-access logging (questions viewed, etc.)
  - [x] 5.4. Implement `GET /api/superadmin/audit-logs` with filtering (tenant, user, time range, resource type)
  - [x] 5.5. Implement pagination (max 500 per page) and 10-second query SLA
  - [x] 5.6. Implement "audit the audit" — log Superadmin queries to audit log
  - [x] 5.7. Ensure audit log is append-only (no update/delete endpoints)

- [x] 6. Siswa Account Sync Module <!--optional-->
  - [x] 6.1. Create `SiswaAccountModule` with service, controller, and cron job
  - [x] 6.2. Implement sync logic: query LMS `siswa` where status='aktif' AND nisn IS NOT NULL, compare with `cbt_siswa_account`
  - [x] 6.3. Create new accounts: hash default password (tanggal_lahir DDMMYYYY), set must_change_password=true
  - [x] 6.4. Handle NISN changes: update login identifier, flag for admin notification
  - [x] 6.5. Handle status non-aktif: deactivate account, remove from Draft/Packaged sessions
  - [x] 6.6. Handle NISN→null: set needs_review=true (do NOT delete)
  - [x] 6.7. Implement `@Cron('0 2 * * *')` for daily sync (2 AM)
  - [x] 6.8. Implement `POST /api/siswa-accounts/sync` — manual trigger (Admin only)
  - [x] 6.9. Implement `GET /api/siswa-accounts` — list accounts with filters (Admin only)
  - [x] 6.10. Implement `POST /api/siswa-accounts/:id/reset-password` — reset to default + must_change_password (Admin only)
  - [x] 6.11. Log sync results in audit log

- [x] 7. Pelaksanaan Ujian Module <!--optional-->
  - [x] 7.1. Create `PelaksanaanUjianModule` with CRUD controller and service
  - [x] 7.2. Implement `POST /api/pelaksanaan-ujian` — create with tahun_ajaran, periode_rapor, komponen_penilaian
  - [x] 7.3. Enforce unique constraint: (tenant_id, tahun_ajaran_id, periode_rapor, komponen_penilaian_id)
  - [x] 7.4. Enforce max one active per tenant (partial unique index)
  - [x] 7.5. Auto-generate nama from periode + komponen_penilaian nama
  - [x] 7.6. Implement `PATCH /api/pelaksanaan-ujian/:id/deactivate` with guards
  - [x] 7.7. Implement `GET /api/pelaksanaan-ujian` — list all (active + historical)
  - [x] 7.8. Implement `GET /api/pelaksanaan-ujian/active` — get current active (for Guru context display)
  - [x] 7.9. Read komponen_penilaian from LMS table for dropdown options

- [x] 8. Question Management Module <!--optional-->
  - [x] 8.1. Create `QuestionModule` with controller and service
  - [x] 8.2. Implement Guru scope derivation from jadwal_pelajaran
  - [x] 8.3. Implement `GET /api/questions` — list questions scoped to guru's assignments
  - [x] 8.4. Implement `POST /api/questions` — create single question with text, options A-E, jawaban_benar
  - [x] 8.5. Implement `PUT /api/questions/:id` — edit (only if not in locked session)
  - [x] 8.6. Implement `DELETE /api/questions/:id` — soft delete with lock validation
  - [x] 8.7. Implement `POST /api/questions/import` — parse Excel, return preview JSON
  - [x] 8.8. Implement `POST /api/questions/import/confirm` — save previewed questions to DB
  - [x] 8.9. Implement `GET /api/questions/template` — download Excel template
  - [x] 8.10. Implement `POST /api/questions/:id/image` — upload image to S3
  - [x] 8.11. Implement question validation and audit logging

- [x] 9. Exam Session Management Module <!--optional-->
  - [x] 9.1. Create `ExamSessionModule` with controller, service, and lifecycle service
  - [x] 9.2. Implement CRUD for exam sessions with state machine transitions
  - [x] 9.3. Implement package/unpackage/cancel lifecycle actions
  - [x] 9.4. Implement batch create for multiple kelas
  - [x] 9.5. Implement result release with score push trigger

- [x] 10. Session Lifecycle Scheduler (Bull Queue) <!--optional-->
  - [x] 10.1. Create `SchedulerModule` with Bull queue "session-lifecycle"
  - [x] 10.2. Implement activate-session job
  - [x] 10.3. Implement auto-submit-timeout job
  - [x] 10.4. Implement periodic session completion check

- [x] 11. Exam Taking Module (Siswa API) <!--optional-->
  - [x] 11.1. Create `ExamTakingModule` with controller and service
  - [x] 11.2. Implement exam start with randomization
  - [x] 11.3. Implement answer saving and submission
  - [x] 11.4. Implement result viewing

- [x] 12. Auto-Grading Module <!--optional-->
  - [x] 12.1. Create `GradingModule` with service
  - [x] 12.2. Implement grading logic with randomization mapping reversal
  - [x] 12.3. Implement deterministic scoring and 5-second SLA

- [x] 13. Score Push Module <!--optional-->
  - [x] 13.1. Create `ScorePushModule` with service
  - [x] 13.2. Implement JSONB merge strategy for rapor_nilai
  - [x] 13.3. Implement retry and audit logging

- [x] 14. WebSocket Gateway (Real-Time) <!--optional-->
  - [x] 14.1. Create `ProctorGatewayModule` with Socket.IO gateway
  - [x] 14.2. Implement `/exam` namespace for siswa clients
  - [x] 14.3. Implement `/proctor` namespace for proctor clients
  - [x] 14.4. Implement heartbeat monitoring and disconnection detection

- [x] 15. Proctor Actions Module <!--optional-->
  - [x] 15.1. Implement proctor dashboard endpoint
  - [x] 15.2. Implement pause/resume/extend actions
  - [x] 15.3. Implement post-exam report generation

- [x] 16. Anti-Cheat Client Implementation (Siswa PWA) <!--optional-->
  - [x] 16.1. Implement fullscreen and visibility monitoring
  - [x] 16.2. Implement keyboard/right-click blocking
  - [x] 16.3. Implement violation reporting via WebSocket

- [x] 17. Superadmin Module <!--optional-->
  - [x] 17.1. Create `SuperadminModule` with read-only access
  - [x] 17.2. Implement tenant overview and audit logging
  - [x] 17.3. Implement notification generation on access

- [x] 18. Notification Module <!--optional-->
  - [x] 18.1. Create `NotificationModule` with CRUD
  - [x] 18.2. Implement notification delivery and retry

- [x] 19. Admin Dashboard (Vue 3 Frontend) <!--optional-->
  - [x] 19.1. Implement CBT section views (Pelaksanaan Ujian, Exam Sessions, Bank Soal)
  - [x] 19.2. Implement Siswa Account management and config views
  - [x] 19.3. Implement notification center

- [x] 20. Proctor Dashboard (Vue 3 Frontend) <!--optional-->
  - [x] 20.1. Implement real-time proctor dashboard with Socket.IO
  - [x] 20.2. Implement participant status cards and actions
  - [x] 20.3. Implement post-exam report view

- [x] 21. Siswa PWA Frontend (React) <!--optional-->
  - [x] 21.1. Implement login and exam list pages
  - [x] 21.2. Implement exam taking interface with timer and navigation
  - [x] 21.3. Implement offline caching and WebSocket connection
  - [x] 21.4. Implement PWA manifest and service worker

- [x] 22. Data Retention & Cleanup <!--optional-->
  - [x] 22.1. Implement snapshot purge cron job
  - [x] 22.2. Implement audit log partitioning
  - [x] 22.3. Implement data export endpoint

- [x] 23. Testing & Performance <!--optional-->
  - [x] 23.1. Write unit tests for grading, score push, session lifecycle
  - [x] 23.2. Write integration tests for auth and question CRUD
  - [x] 23.3. Write load tests for WebSocket and grading SLA

- [x] 24. Deployment & CI/CD <!--optional-->
  - [x] 24.1. Create Dockerfiles and build configs
  - [x] 24.2. Setup GitHub Actions CI pipeline
  - [x] 24.3. Configure production environment

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": [1] },
    { "wave": 2, "tasks": [2, 24] },
    { "wave": 3, "tasks": [3, 4, 5] },
    { "wave": 4, "tasks": [6, 7, 17, 18, 22] },
    { "wave": 5, "tasks": [8, 19] },
    { "wave": 6, "tasks": [9] },
    { "wave": 7, "tasks": [10, 11] },
    { "wave": 8, "tasks": [12, 14, 21] },
    { "wave": 9, "tasks": [13, 15, 16, 20] },
    { "wave": 10, "tasks": [23] }
  ],
  "dependencies": {
    "2": [1],
    "3": [1, 2],
    "4": [1, 2],
    "5": [1, 2],
    "6": [2, 3],
    "7": [2, 3],
    "8": [7],
    "9": [7, 8],
    "10": [9],
    "11": [9, 3],
    "12": [11],
    "13": [9, 12],
    "14": [3, 10],
    "15": [14],
    "16": [14, 21],
    "17": [3, 5],
    "18": [5],
    "19": [4, 7, 8, 9],
    "20": [14, 15],
    "21": [11],
    "22": [2, 5],
    "23": [3, 11, 12, 14],
    "24": [1]
  }
}
```

## Notes

- Tasks 1–3 are the foundation and must be completed first
- Tasks 4–24 are marked optional for incremental execution in future sessions
- The CBT system shares a PostgreSQL database with the existing LMS — CBT tables are prefixed with `cbt_`
- Staff auth uses shared JWT secret with LMS; Siswa has separate auth flow
- Project root is `/Users/mc-g029.00623/Documents/github/cbt-teman-sekolah/`
