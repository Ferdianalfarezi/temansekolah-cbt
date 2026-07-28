# Design Document

## Architecture Overview

CBT Teman Sekolah is a NestJS monolith backend with a Vue 3 (admin/proctor) + React (siswa PWA) frontend, sharing a PostgreSQL database with the existing LMS. Real-time features use WebSocket (Socket.IO) backed by Redis pub/sub for horizontal scaling.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
├─────────────────┬───────────────────┬───────────────────────────┤
│  Vue 3 Admin    │  Vue 3 Proctor    │  React Siswa PWA          │
│  (Desktop)      │  (Desktop+Tablet) │  (Mobile+Desktop)         │
└────────┬────────┴─────────┬─────────┴──────────────┬────────────┘
         │ REST API          │ REST + WebSocket        │ REST + WS
         ▼                   ▼                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NestJS API Server                            │
├─────────────────────────────────────────────────────────────────┤
│  Auth Guard │ Tenant Guard │ Role Guard │ Audit Interceptor      │
├─────────────────────────────────────────────────────────────────┤
│  Modules:                                                        │
│  ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌───────────────┐  │
│  │   Auth   │ │Pelaksanaan   │ │ Question │ │  Exam Session │  │
│  │          │ │   Ujian      │ │   Bank   │ │               │  │
│  └──────────┘ └──────────────┘ └──────────┘ └───────────────┘  │
│  ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  Proctor │ │  Score Push  │ │  Audit   │ │    Config     │  │
│  │ Gateway  │ │              │ │   Log    │ │               │  │
│  └──────────┘ └──────────────┘ └──────────┘ └───────────────┘  │
│  ┌──────────┐ ┌──────────────┐ ┌──────────┐                    │
│  │  Siswa   │ │   Grading    │ │   Sync   │                    │
│  │  Account │ │              │ │  (Cron)  │                    │
│  └──────────┘ └──────────────┘ └──────────┘                    │
├─────────────────────────────────────────────────────────────────┤
│  Socket.IO Adapter (Redis)                                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌───────────────┐ ┌─────────────────────────┐
│   PostgreSQL    │ │     Redis     │ │    S3 (Question Images) │
│  (Shared w/LMS) │ │  (Pub/Sub +   │ │                         │
│                 │ │   Sessions)   │ │                         │
└─────────────────┘ └───────────────┘ └─────────────────────────┘
```

## Tech Stack

| Layer                  | Technology                                 |
| ---------------------- | ------------------------------------------ |
| Backend                | NestJS 10, TypeScript, Drizzle ORM         |
| Siswa Frontend         | React 18, Vite, TailwindCSS, PWA (Workbox) |
| Admin/Proctor Frontend | Vue 3 (extends existing `apps/admin`)      |
| Database               | PostgreSQL (shared with LMS)               |
| Real-time              | Socket.IO + @nestjs/websockets             |
| Cache/Pub-Sub          | Redis (ioredis)                            |
| Queue                  | Bull (session lifecycle scheduler)         |
| Storage                | AWS S3 (question images)                   |
| Auth                   | Passport JWT (shared secret with LMS)      |

## Design Decisions

### Why Separate Siswa Frontend (React PWA)?

- Siswa needs PWA with Service Worker for offline caching — Vue 3 PWA tooling is less mature
- Exam interface is fundamentally different UX from admin CRUD
- Separate deployment means siswa app can be CDN-cached aggressively
- Anti-cheat JS logic is complex and should be isolated
- Admin/Proctor extends existing Vue 3 admin app (already built)

### Why Monolith Backend (Not Microservices)?

- Shares database with LMS — transaction boundaries are simpler in one service
- Team size likely small — microservices overhead not justified
- Can extract later if needed (proctor WebSocket gateway is already isolated)

### Why Socket.IO Over Raw WebSocket?

- Built-in room support (one room per Exam_Session)
- Automatic reconnection handling
- Fallback to polling on unreliable networks (student mobile devices)
- Redis adapter for multi-instance pub/sub out of the box

---

## Database Schema (CBT-Owned Tables)

All CBT tables live in the same PostgreSQL instance as LMS. CBT tables are prefixed with `cbt_` to avoid collision. LMS tables are read-only (except rapor_nilai for score push).

### cbt_tenant_config

```sql
CREATE TABLE cbt_tenant_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenant(id),
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
  default_anti_cheat_level VARCHAR(10) NOT NULL DEFAULT 'standard'
    CHECK (default_anti_cheat_level IN ('standard', 'relaxed')),
  max_violation_count INTEGER NOT NULL DEFAULT 3,
  early_submission_threshold_pct INTEGER NOT NULL DEFAULT 20
    CHECK (early_submission_threshold_pct BETWEEN 5 AND 50),
  default_result_detail_level VARCHAR(25) NOT NULL DEFAULT 'score_only'
    CHECK (default_result_detail_level IN ('score_only', 'score_with_indicator', 'full_detail')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### cbt_pelaksanaan_ujian

```sql
CREATE TABLE cbt_pelaksanaan_ujian (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id),
  tahun_ajaran_id UUID NOT NULL REFERENCES tahun_ajaran(id),
  periode_rapor VARCHAR(20) NOT NULL
    CHECK (periode_rapor IN ('uts_semester_1', 'semester_1', 'uts_semester_2', 'semester_2')),
  komponen_penilaian_id UUID NOT NULL REFERENCES komponen_penilaian(id),
  nama VARCHAR(255) NOT NULL, -- auto-generated: "UTS Semester 1 - Pengetahuan"
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, tahun_ajaran_id, periode_rapor, komponen_penilaian_id)
);
-- Partial unique: only one active per tenant
CREATE UNIQUE INDEX idx_cbt_pu_active_tenant
  ON cbt_pelaksanaan_ujian (tenant_id) WHERE is_active = true;
```

### cbt_question

```sql
CREATE TABLE cbt_question (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id),
  pelaksanaan_ujian_id UUID NOT NULL REFERENCES cbt_pelaksanaan_ujian(id),
  mata_pelajaran_id UUID NOT NULL REFERENCES mata_pelajaran(id),
  tingkat INTEGER, -- NULL if kelas-specific
  kelas_id UUID REFERENCES kelas(id), -- NULL if tingkat-level
  created_by UUID NOT NULL REFERENCES "user"(id),
  teks_soal TEXT NOT NULL CHECK (char_length(teks_soal) BETWEEN 1 AND 2000),
  gambar_soal_url VARCHAR(500),
  opsi_a TEXT NOT NULL CHECK (char_length(opsi_a) BETWEEN 1 AND 500),
  gambar_a_url VARCHAR(500),
  opsi_b TEXT NOT NULL CHECK (char_length(opsi_b) BETWEEN 1 AND 500),
  gambar_b_url VARCHAR(500),
  opsi_c TEXT NOT NULL CHECK (char_length(opsi_c) BETWEEN 1 AND 500),
  gambar_c_url VARCHAR(500),
  opsi_d TEXT NOT NULL CHECK (char_length(opsi_d) BETWEEN 1 AND 500),
  gambar_d_url VARCHAR(500),
  opsi_e TEXT CHECK (opsi_e IS NULL OR char_length(opsi_e) BETWEEN 1 AND 500),
  gambar_e_url VARCHAR(500),
  jawaban_benar CHAR(1) NOT NULL CHECK (jawaban_benar IN ('A','B','C','D','E')),
  nomor_urut INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (tingkat IS NOT NULL OR kelas_id IS NOT NULL), -- must have scope
  CHECK (NOT (opsi_e IS NULL AND jawaban_benar = 'E')) -- can't answer E without option E
);
CREATE INDEX idx_cbt_question_bank ON cbt_question (pelaksanaan_ujian_id, mata_pelajaran_id, tingkat);
CREATE INDEX idx_cbt_question_kelas ON cbt_question (pelaksanaan_ujian_id, mata_pelajaran_id, kelas_id);
```

### cbt_exam_session

```sql
CREATE TYPE cbt_exam_session_status AS ENUM ('draft', 'packaged', 'active', 'completed', 'cancelled');
CREATE TYPE cbt_anti_cheat_level AS ENUM ('standard', 'relaxed');
CREATE TYPE cbt_result_detail_level AS ENUM ('score_only', 'score_with_indicator', 'full_detail');

CREATE TABLE cbt_exam_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id),
  pelaksanaan_ujian_id UUID NOT NULL REFERENCES cbt_pelaksanaan_ujian(id),
  mata_pelajaran_id UUID NOT NULL REFERENCES mata_pelajaran(id),
  kelas_id UUID NOT NULL REFERENCES kelas(id),
  proctor_id UUID NOT NULL REFERENCES "user"(id),
  status cbt_exam_session_status NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 5 AND 360),
  randomize_questions BOOLEAN NOT NULL DEFAULT false,
  randomize_options BOOLEAN NOT NULL DEFAULT false,
  anti_cheat_level cbt_anti_cheat_level NOT NULL DEFAULT 'standard',
  result_detail_level cbt_result_detail_level NOT NULL DEFAULT 'score_only',
  results_released BOOLEAN NOT NULL DEFAULT false,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cbt_session_tenant_status ON cbt_exam_session (tenant_id, status);
CREATE INDEX idx_cbt_session_proctor ON cbt_exam_session (proctor_id, scheduled_at);
```

### cbt_exam_session_question (Snapshot at packaging time)

```sql
CREATE TABLE cbt_exam_session_question (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID NOT NULL REFERENCES cbt_exam_session(id),
  question_id UUID NOT NULL REFERENCES cbt_question(id),
  nomor_urut INTEGER NOT NULL,
  UNIQUE (exam_session_id, question_id)
);
CREATE INDEX idx_cbt_esq_session ON cbt_exam_session_question (exam_session_id, nomor_urut);
```

### cbt_siswa_account

```sql
CREATE TABLE cbt_siswa_account (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id),
  siswa_id UUID NOT NULL REFERENCES siswa(id),
  nisn VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  needs_review BOOLEAN NOT NULL DEFAULT false, -- flagged for admin review
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, nisn)
);
CREATE INDEX idx_cbt_siswa_account_siswa ON cbt_siswa_account (siswa_id);
```

### cbt_exam_participant

```sql
CREATE TYPE cbt_participant_status AS ENUM ('assigned', 'in_progress', 'paused', 'disconnected', 'submitted', 'auto_submitted');

CREATE TABLE cbt_exam_participant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID NOT NULL REFERENCES cbt_exam_session(id),
  siswa_account_id UUID NOT NULL REFERENCES cbt_siswa_account(id),
  status cbt_participant_status NOT NULL DEFAULT 'assigned',
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  remaining_seconds INTEGER, -- tracks paused/extended time
  extension_seconds INTEGER NOT NULL DEFAULT 0,
  violation_count INTEGER NOT NULL DEFAULT 0,
  is_flagged_cheating BOOLEAN NOT NULL DEFAULT false,
  is_early_submission BOOLEAN NOT NULL DEFAULT false,
  score_correct INTEGER,
  score_total INTEGER,
  score_percentage NUMERIC(5,2),
  randomization_mapping JSONB, -- {questionOrder: [...ids], optionMappings: {qId: [shuffled]}}
  submission_type VARCHAR(20), -- 'manual', 'auto_timeout', 'auto_disconnect'
  UNIQUE (exam_session_id, siswa_account_id)
);
CREATE INDEX idx_cbt_participant_session ON cbt_exam_participant (exam_session_id, status);
CREATE INDEX idx_cbt_participant_siswa ON cbt_exam_participant (siswa_account_id);
```

### cbt_answer

```sql
CREATE TABLE cbt_answer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES cbt_exam_participant(id),
  question_id UUID NOT NULL REFERENCES cbt_question(id),
  selected_option CHAR(1) CHECK (selected_option IN ('A','B','C','D','E')),
  is_correct BOOLEAN, -- set during grading
  answered_at TIMESTAMPTZ,
  UNIQUE (participant_id, question_id)
);
CREATE INDEX idx_cbt_answer_participant ON cbt_answer (participant_id);
```

### cbt_answer_snapshot

```sql
CREATE TABLE cbt_answer_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES cbt_exam_participant(id),
  answers JSONB NOT NULL, -- {questionId: {option: 'A', timestamp: '...'}}
  current_question_index INTEGER,
  remaining_seconds INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cbt_snapshot_participant ON cbt_answer_snapshot (participant_id, created_at DESC);
```

### cbt_violation_event

```sql
CREATE TABLE cbt_violation_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES cbt_exam_participant(id),
  violation_type VARCHAR(30) NOT NULL
    CHECK (violation_type IN ('tab_switch', 'focus_loss', 'fullscreen_exit', 'multiple_login')),
  duration_ms INTEGER, -- how long focus was lost
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cbt_violation_participant ON cbt_violation_event (participant_id, detected_at);
```

### cbt_proctor_action

```sql
CREATE TABLE cbt_proctor_action (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID NOT NULL REFERENCES cbt_exam_session(id),
  participant_id UUID NOT NULL REFERENCES cbt_exam_participant(id),
  proctor_id UUID NOT NULL REFERENCES "user"(id),
  action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('pause', 'resume', 'extend')),
  extension_minutes INTEGER, -- only for 'extend'
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### cbt_audit_log

```sql
CREATE TABLE cbt_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenant(id), -- NULL for cross-tenant superadmin queries
  actor_id UUID NOT NULL, -- user or siswa_account id
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('staff', 'siswa', 'system')),
  actor_role VARCHAR(20) NOT NULL,
  action VARCHAR(30) NOT NULL, -- 'read', 'create', 'update', 'delete', 'login', 'query'
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  resource_ids UUID[], -- for batch reads (e.g., viewing question list)
  before_value JSONB,
  after_value JSONB,
  metadata JSONB, -- additional context (filter params, IP, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Time-partitioned for performance (partition by month)
CREATE INDEX idx_cbt_audit_tenant_time ON cbt_audit_log (tenant_id, created_at DESC);
CREATE INDEX idx_cbt_audit_actor ON cbt_audit_log (actor_id, created_at DESC);
CREATE INDEX idx_cbt_audit_resource ON cbt_audit_log (resource_type, resource_id, created_at DESC);
```

### cbt_notification (Admin_Sekolah notifications about Superadmin access)

```sql
CREATE TABLE cbt_notification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id),
  recipient_role VARCHAR(20) NOT NULL DEFAULT 'admin',
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  is_high_priority BOOLEAN NOT NULL DEFAULT false,
  is_read BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  related_audit_log_id UUID REFERENCES cbt_audit_log(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cbt_notification_tenant ON cbt_notification (tenant_id, is_read, created_at DESC);
```

---

## API Design

### Authentication

| Method | Endpoint                          | Role   | Description                         |
| ------ | --------------------------------- | ------ | ----------------------------------- |
| POST   | `/api/auth/siswa/login`           | Public | Siswa login (NISN + password)       |
| POST   | `/api/auth/siswa/change-password` | Siswa  | First-login password change         |
| POST   | `/api/auth/siswa/reset-password`  | Public | Self-reset via NISN + tanggal_lahir |

Staff (Admin, Guru, Superadmin) authenticate via LMS JWT — no separate login endpoint needed.

### Pelaksanaan Ujian

| Method | Endpoint                                | Role        | Description                    |
| ------ | --------------------------------------- | ----------- | ------------------------------ |
| GET    | `/api/pelaksanaan-ujian`                | Admin       | List all (active + historical) |
| POST   | `/api/pelaksanaan-ujian`                | Admin       | Create new                     |
| PATCH  | `/api/pelaksanaan-ujian/:id/deactivate` | Admin       | Deactivate                     |
| GET    | `/api/pelaksanaan-ujian/active`         | Admin, Guru | Get current active             |

### Exam Sessions

| Method | Endpoint                                 | Role           | Description                          |
| ------ | ---------------------------------------- | -------------- | ------------------------------------ |
| GET    | `/api/exam-sessions`                     | Admin          | List sessions (filterable by status) |
| POST   | `/api/exam-sessions`                     | Admin          | Create single session                |
| POST   | `/api/exam-sessions/batch`               | Admin          | Batch create for multiple kelas      |
| GET    | `/api/exam-sessions/:id`                 | Admin, Guru    | Get session detail                   |
| PATCH  | `/api/exam-sessions/:id`                 | Admin          | Modify draft session                 |
| POST   | `/api/exam-sessions/:id/package`         | Admin          | Transition Draft→Packaged            |
| POST   | `/api/exam-sessions/:id/unpackage`       | Admin          | Transition Packaged→Draft            |
| POST   | `/api/exam-sessions/:id/cancel`          | Admin          | Cancel packaged session              |
| POST   | `/api/exam-sessions/:id/release-results` | Admin          | Release results + score push         |
| GET    | `/api/exam-sessions/:id/report`          | Admin, Proctor | Post-exam report                     |

### Questions

| Method | Endpoint                        | Role | Description                                     |
| ------ | ------------------------------- | ---- | ----------------------------------------------- |
| GET    | `/api/questions`                | Guru | List questions (scoped to guru's mapel/tingkat) |
| POST   | `/api/questions`                | Guru | Create single question                          |
| POST   | `/api/questions/import`         | Guru | Upload Excel for preview                        |
| POST   | `/api/questions/import/confirm` | Guru | Save previewed import                           |
| GET    | `/api/questions/template`       | Guru | Download Excel template                         |
| GET    | `/api/questions/:id`            | Guru | Get question detail                             |
| PUT    | `/api/questions/:id`            | Guru | Update question                                 |
| DELETE | `/api/questions/:id`            | Guru | Delete question                                 |
| POST   | `/api/questions/:id/image`      | Guru | Upload question/option image                    |
| GET    | `/api/questions/history`        | Guru | Question history (all pelaksanaan)              |

### Siswa Exam Interface

| Method | Endpoint                              | Role  | Description                                |
| ------ | ------------------------------------- | ----- | ------------------------------------------ |
| GET    | `/api/siswa/exam-sessions`            | Siswa | List assigned sessions                     |
| GET    | `/api/siswa/exam-sessions/:id/start`  | Siswa | Start exam (get questions + randomization) |
| POST   | `/api/siswa/exam-sessions/:id/answer` | Siswa | Save single answer                         |
| POST   | `/api/siswa/exam-sessions/:id/submit` | Siswa | Final submission                           |
| GET    | `/api/siswa/exam-sessions/:id/result` | Siswa | View released results                      |

### Proctor

| Method | Endpoint                                             | Role    | Description                 |
| ------ | ---------------------------------------------------- | ------- | --------------------------- |
| GET    | `/api/proctor/sessions/:id/dashboard`                | Proctor | Get session monitoring data |
| POST   | `/api/proctor/sessions/:id/participants/:pid/pause`  | Proctor | Pause timer                 |
| POST   | `/api/proctor/sessions/:id/participants/:pid/resume` | Proctor | Resume timer                |
| POST   | `/api/proctor/sessions/:id/participants/:pid/extend` | Proctor | Extend time                 |

### Siswa Account Management

| Method | Endpoint                                 | Role  | Description               |
| ------ | ---------------------------------------- | ----- | ------------------------- |
| POST   | `/api/siswa-accounts/sync`               | Admin | Manual sync trigger       |
| GET    | `/api/siswa-accounts`                    | Admin | List siswa accounts       |
| POST   | `/api/siswa-accounts/:id/reset-password` | Admin | Reset to default password |

### Superadmin

| Method | Endpoint                           | Role       | Description                      |
| ------ | ---------------------------------- | ---------- | -------------------------------- |
| GET    | `/api/superadmin/tenants`          | Superadmin | List all tenants with CBT status |
| GET    | `/api/superadmin/tenants/:id/data` | Superadmin | View tenant CBT data (read-only) |
| GET    | `/api/superadmin/audit-logs`       | Superadmin | Query audit logs (cross-tenant)  |

### Configuration

| Method | Endpoint      | Role  | Description              |
| ------ | ------------- | ----- | ------------------------ |
| GET    | `/api/config` | Admin | Get tenant CBT config    |
| PATCH  | `/api/config` | Admin | Update tenant CBT config |

---

## WebSocket Events (Socket.IO)

### Namespaces

- `/exam` — Siswa exam-taking (heartbeat, answer sync, anti-cheat events)
- `/proctor` — Proctor dashboard real-time updates

### Siswa → Server Events

| Event              | Payload                                             | Description                  |
| ------------------ | --------------------------------------------------- | ---------------------------- |
| `join_session`     | `{sessionId, token}`                                | Join exam room               |
| `heartbeat`        | `{timestamp}`                                       | Every 5 seconds              |
| `answer_save`      | `{questionId, option, timestamp}`                   | Individual answer            |
| `answer_snapshot`  | `{answers: {...}, questionIndex, remainingSeconds}` | Periodic full snapshot       |
| `violation_report` | `{type, timestamp, durationMs}`                     | Anti-cheat event from client |

### Server → Siswa Events

| Event                | Payload                                   | Description                  |
| -------------------- | ----------------------------------------- | ---------------------------- |
| `session_started`    | `{questions, startedAt, durationSeconds}` | Exam activation              |
| `timer_paused`       | `{reason}`                                | Proctor paused               |
| `timer_resumed`      | `{remainingSeconds}`                      | Proctor resumed              |
| `timer_extended`     | `{additionalSeconds, newTotal}`           | Proctor extended             |
| `force_submit`       | `{reason}`                                | Timer expired / force submit |
| `session_terminated` | `{reason}`                                | Kicked due to another login  |
| `save_confirmed`     | `{questionId, timestamp}`                 | Answer save ACK              |

### Server → Proctor Events

| Event                      | Payload                                                   | Description            |
| -------------------------- | --------------------------------------------------------- | ---------------------- |
| `participant_update`       | `{participantId, status, violationCount, isFlagged, ...}` | Any status change      |
| `violation_alert`          | `{participantId, type, count, timestamp}`                 | New violation detected |
| `participant_disconnected` | `{participantId, lastHeartbeat}`                          | Disconnect detected    |
| `participant_reconnected`  | `{participantId}`                                         | Back online            |
| `early_submission`         | `{participantId, durationPct}`                            | Suspiciously fast      |
| `session_completed`        | `{sessionId}`                                             | All participants done  |

---

## Key Flows

### Flow 1: Exam Session Lifecycle (Scheduler)

```
Bull Queue: "session-lifecycle"

Job: activate-session
  Triggered: 60s before scheduled_at (or at scheduled_at)
  Action:
    1. Find Packaged sessions where scheduled_at <= now
    2. Transition to Active
    3. Emit Socket.IO event to waiting siswa clients

Job: check-session-completion
  Triggered: Periodic (every 30s) for Active sessions
  Action:
    1. For each Active session, check if all participants are submitted/auto_submitted
    2. Also check if max_end_time (scheduled_at + duration + max_extension) has passed
    3. If complete, transition to Completed, generate post-exam report

Job: auto-submit-timeout
  Triggered: When a participant's individual timer expires
  Action:
    1. Get latest Answer_Snapshot
    2. Save as final answers
    3. Grade
    4. Mark participant as 'auto_submitted'
```

### Flow 2: Siswa Starts Exam

```
1. Siswa calls GET /api/siswa/exam-sessions/:id/start
2. Server validates: session is Active, siswa is assigned, not already submitted
3. Server generates randomization mapping (if enabled):
   - Shuffle question IDs using Fisher-Yates with crypto.randomBytes seed
   - Shuffle option order per question, store original→shuffled mapping
   - Save mapping to cbt_exam_participant.randomization_mapping
4. Server returns questions in randomized order (without correct answers)
5. Siswa client connects to WebSocket /exam namespace, joins session room
6. Client starts heartbeat (every 5s), periodic snapshot (every 30s)
7. Anti-cheat module initializes (fullscreen, visibility monitoring)
```

### Flow 3: Grading

```
1. Submission received (manual or auto)
2. Load participant's randomization_mapping
3. For each answer:
   a. Map the displayed option back to original option via randomization_mapping
   b. Compare with cbt_question.jawaban_benar
   c. Set cbt_answer.is_correct
4. Calculate: correct_count / total_questions * 100 = percentage
5. Store score in cbt_exam_participant
6. Mark participant status as 'submitted'
7. If exam had question randomization, scores are still comparable because
   all students get the same questions — only order differs
```

### Flow 4: Score Push to LMS Rapor

```
1. Admin clicks "Release Results" for an Exam_Session
2. System checks rapor status for target kelas/tahunAjaran/periode:
   a. If rapor.status = 'final' → reject, notify admin
   b. If rapor doesn't exist → create draft rapor record
3. For each participant with a score:
   a. Find existing rapor_nilai for (rapor_id, siswa_id, mapel_id, tenant_id)
   b. If exists:
      - Parse komponen_nilai JSONB
      - Find entry with matching komponen_penilaian_id
      - Update or insert that entry's nilai
      - Write back merged JSONB
   c. If not exists:
      - Resolve guru_id from jadwal_pelajaran (mapel + kelas in active tahun_ajaran)
      - Insert new rapor_nilai with komponen_nilai: [{komponen_id, nilai}]
4. Set exam_session.results_released = true
5. Log score push in cbt_audit_log
```

### Flow 5: Disconnection & Reconnection

```
Disconnect Detection:
1. Server tracks last heartbeat per participant (Redis hash)
2. Scheduled check every 5s: if last_heartbeat > 15s ago → disconnect
3. On disconnect:
   a. Set participant status = 'disconnected'
   b. Pause their timer (save remaining_seconds)
   c. Emit participant_disconnected to proctor room
   d. Keep latest answer_snapshot intact

Reconnection:
1. Siswa reconnects to WebSocket, sends join_session
2. Server validates: session still Active, participant not submitted
3. Server sends back: latest server answers, remaining_seconds, question_index
4. Client sends any locally-cached answers with timestamps
5. Server applies last-write-wins merge per question
6. Resume timer from paused value
7. Emit participant_reconnected to proctor room
```

### Flow 6: Siswa Account Sync (Cron)

```
Runs: Every 24 hours (configurable per tenant)
Also: On-demand via POST /api/siswa-accounts/sync

Steps:
1. For each active tenant:
   a. Query LMS siswa table: status='aktif', nisn IS NOT NULL
   b. Compare with existing cbt_siswa_account records
   c. New siswa (in LMS, not in CBT): create account with default password
   d. NISN changed: update nisn field, flag for admin notification
   e. Status no longer aktif: deactivate account, remove from Draft/Packaged sessions
   f. NISN became null: set needs_review=true
2. Log sync results in cbt_audit_log
```

---

## Security Design

### Authentication Flow

```
Staff (Admin/Guru/Superadmin):
  LMS issues JWT → shared secret → CBT validates same JWT
  JWT payload: {userId, tenantId, role, iat, exp}

Siswa:
  CBT issues own JWT on /auth/siswa/login
  JWT payload: {siswaAccountId, tenantId, role: 'siswa', iat, exp}
  Token validity: 12 hours
```

### Tenant Isolation

- Every CBT table has `tenant_id` column
- `TenantGuard` middleware extracts `tenantId` from JWT, injects into request context
- Drizzle queries automatically filter by `tenant_id` via a base query helper
- Superadmin bypasses tenant filter but gets audit-logged on every access

### Role Permission Matrix

| Action                         | Superadmin | Admin_Sekolah |    Guru     |  Siswa   |
| ------------------------------ | :--------: | :-----------: | :---------: | :------: |
| View all tenants               |     ✅     |      ❌       |     ❌      |    ❌    |
| View own tenant CBT data       |  ✅ (all)  |      ✅       | ✅ (scoped) | ✅ (own) |
| Manage Pelaksanaan_Ujian       |     ❌     |      ✅       |     ❌      |    ❌    |
| Manage Exam_Sessions           |     ❌     |      ✅       |     ❌      |    ❌    |
| Create/Edit Questions          |     ❌     |      ❌       | ✅ (scoped) |    ❌    |
| Take Exam                      |     ❌     |      ❌       |     ❌      |    ✅    |
| Proctor (monitor/pause/extend) |     ❌     |      ✅       |     ✅      |    ❌    |
| Release Results                |     ❌     |      ✅       |     ❌      |    ❌    |
| View Audit Logs                |     ✅     |      ❌       |     ❌      |    ❌    |
| Manage Siswa Accounts          |     ❌     |      ✅       |     ❌      |    ❌    |
| Manage Config                  |     ❌     |      ✅       |     ❌      |    ❌    |

---

## Project Structure

```
cbt-teman-sekolah/
├── apps/
│   ├── api/                          # NestJS backend
│   │   └── src/
│   │       ├── common/
│   │       │   ├── decorators/       # @CurrentUser, @Roles, @TenantScoped
│   │       │   ├── guards/           # JwtAuthGuard, RolesGuard, TenantGuard
│   │       │   ├── interceptors/     # AuditInterceptor
│   │       │   └── helpers/          # tenant-scoped query builder
│   │       ├── config/               # env config, jwt config
│   │       ├── drizzle/
│   │       │   ├── schema/           # CBT table definitions
│   │       │   └── migrations/       # CBT migrations
│   │       ├── modules/
│   │       │   ├── auth/             # Siswa auth (login, reset, change-password)
│   │       │   ├── pelaksanaan-ujian/
│   │       │   ├── exam-session/     # CRUD + lifecycle transitions
│   │       │   ├── question/         # CRUD + import/export
│   │       │   ├── siswa-account/    # Sync, list, reset-password
│   │       │   ├── exam-taking/      # Siswa exam interface (start, answer, submit)
│   │       │   ├── proctor/          # WebSocket gateway + REST actions
│   │       │   ├── grading/          # Auto-grade service
│   │       │   ├── score-push/       # LMS rapor_nilai integration
│   │       │   ├── audit-log/        # Audit log write + query
│   │       │   ├── notification/     # Admin notifications
│   │       │   ├── config/           # Tenant config CRUD
│   │       │   ├── superadmin/       # Tenant overview + read-only data
│   │       │   └── scheduler/        # Bull queues for session lifecycle
│   │       ├── app.module.ts
│   │       └── main.ts
│   │
│   ├── admin/                        # Vue 3 admin + proctor (extends existing)
│   │   └── src/
│   │       ├── views/cbt/            # CBT-specific views
│   │       │   ├── PelaksanaanUjianView.vue
│   │       │   ├── ExamSessionListView.vue
│   │       │   ├── ExamSessionDetailView.vue
│   │       │   ├── QuestionBankView.vue
│   │       │   ├── ProctorDashboardView.vue
│   │       │   ├── SiswaAccountView.vue
│   │       │   ├── CbtConfigView.vue
│   │       │   └── SuperadminView.vue
│   │       └── components/cbt/       # CBT-specific components
│   │
│   └── siswa/                        # React PWA for exam-taking
│       ├── public/
│       │   └── sw.js                 # Service Worker
│       └── src/
│           ├── pages/
│           │   ├── LoginPage.tsx
│           │   ├── ExamListPage.tsx
│           │   ├── ExamPage.tsx       # Main exam interface
│           │   └── ResultPage.tsx
│           ├── hooks/
│           │   ├── useExamTimer.ts
│           │   ├── useAntiCheat.ts
│           │   ├── useWebSocket.ts
│           │   └── useOfflineSync.ts
│           ├── services/
│           │   ├── api.ts
│           │   └── offlineStorage.ts
│           └── main.tsx
│
├── packages/
│   └── shared/                       # Shared types/enums
│       └── src/
│           ├── cbt-enums.ts
│           └── cbt-interfaces.ts
│
├── docs/
├── .kiro/
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│              Railway / Cloud Deploy               │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌─────────────┐  ┌─────────────┐               │
│  │  API Server │  │  API Server │  (2+ instances)│
│  │  (NestJS)   │  │  (NestJS)   │               │
│  └──────┬──────┘  └──────┬──────┘               │
│         │                 │                       │
│         └────────┬────────┘                       │
│                  │                                │
│         ┌────────▼────────┐                       │
│         │     Redis       │                       │
│         │ (Socket.IO      │                       │
│         │  adapter +      │                       │
│         │  Bull queues +  │                       │
│         │  session cache) │                       │
│         └────────┬────────┘                       │
│                  │                                │
│         ┌────────▼────────┐                       │
│         │   PostgreSQL    │                       │
│         │ (Shared w/ LMS) │                       │
│         └─────────────────┘                       │
│                                                   │
│  Static Assets (CDN):                             │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ Admin (Vue)  │  │ Siswa (React)│             │
│  │ Vercel/CF    │  │ Vercel/CF    │             │
│  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────┘
```

---

## Non-Functional Considerations

### Performance

- Answer saves: debounce on client (500ms), batch if multiple changes within window
- WebSocket rooms: one room per active exam_session (max ~300 connections per room)
- Redis caching: exam questions cached on first participant load (TTL = session duration)
- Audit log: append-only, time-partitioned by month for query performance
- Grading: synchronous in-memory (no DB round-trip for answer key — cached at session start)

### Data Retention

- Answer snapshots: cron job purges after 30 days post-completion
- Audit logs: partitioned, oldest partitions dropped after 3 years
- Question images: S3 lifecycle rules (move to Glacier after 2 years if pelaksanaan inactive)

### Horizontal Scaling

- Socket.IO Redis adapter: any server instance can handle any client
- Bull queues: Redis-backed, workers can run on any instance
- Stateless API: all session state in Redis (remaining_seconds, heartbeat timestamps)
- Database: connection pooling via pgBouncer if needed at scale
