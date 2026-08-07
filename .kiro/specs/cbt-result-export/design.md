# Design Document: CBT Result Export

## Overview

This design document describes the replacement of the Score Push Module with an Excel export feature in CBT Teman Sekolah. The current Score Push Module was intended to write exam scores directly to the LMS `rapor_nilai` table, but it is not integrated into the result release flow. Schools prefer flexibility in how they process CBT results before entering them into their grading system.

The new approach:
1. **Removes** the unused Score Push Module (`apps/api/src/modules/score-push/`)
2. **Adds** an Excel export service that generates `.xlsx` files with exam results
3. **Supports** both single session and bulk (Pelaksanaan Ujian) exports
4. **Handles** randomization mapping to show original answers in exports

### Key Design Decisions

**Why remove Score Push instead of keeping it optional?**
- The module is not integrated — `releaseResults()` does not call `pushScores()`
- Keeping dead code increases maintenance burden and confusion
- Schools want manual control over when scores enter the grading system
- If needed later, it can be re-implemented with proper design

**Why exceljs over xlsx library?**
- exceljs supports streaming writes for large datasets
- Better TypeScript support and active maintenance
- Built-in cell formatting, column width auto-fit, and multiple sheets
- Memory-efficient for bulk exports with many participants

**Why stream response instead of generating file then sending?**
- Sessions can have 500+ participants; bulk exports can have 25,000+ rows
- Streaming prevents memory spikes and client timeouts
- `exceljs` supports `workbook.xlsx.write(stream)` natively

---

## Architecture

### Module Structure

```
apps/api/src/modules/
├── result-export/                    # NEW MODULE
│   ├── result-export.module.ts
│   ├── result-export.service.ts
│   ├── result-export.controller.ts
│   ├── dto/
│   │   └── export-query.dto.ts
│   └── index.ts
├── score-push/                       # TO BE DELETED
│   ├── score-push.module.ts
│   ├── score-push.service.ts
│   ├── score-push.service.spec.ts
│   └── index.ts
└── exam-session/
    └── exam-session.controller.ts    # Add export endpoint route
```

### Updated Architecture Diagram

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
│  │  Proctor │ │Result Export │ │  Audit   │ │    Config     │  │
│  │ Gateway  │ │   (NEW)      │ │   Log    │ │               │  │
│  └──────────┘ └──────────────┘ └──────────┘ └───────────────┘  │
│  ┌──────────┐ ┌──────────────┐ ┌──────────┐                    │
│  │  Siswa   │ │   Grading    │ │   Sync   │                    │
│  │  Account │ │              │ │  (Cron)  │                    │
│  └──────────┘ └──────────────┘ └──────────┘                    │
├─────────────────────────────────────────────────────────────────┤
│  Socket.IO Adapter (Redis)                                       │
└────────────────────────────────┬────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────┐
         ▼                       ▼                   ▼
┌─────────────────┐     ┌───────────────┐   ┌─────────────────────────┐
│   PostgreSQL    │     │     Redis     │   │    S3 (Question Images) │
│  (Shared w/LMS) │     │  (Pub/Sub +   │   │                         │
│                 │     │   Sessions)   │   │                         │
└─────────────────┘     └───────────────┘   └─────────────────────────┘
```

---

## Components and Interfaces

### ResultExportService

Core service responsible for generating Excel exports.

```typescript
interface ExportOptions {
  includeDetailedAnswers: boolean;
}

interface SessionExportMetadata {
  namaUjian: string;           // mata_pelajaran.nama
  tanggalUjian: string;        // scheduled_at formatted
  durasi: number;              // duration_minutes
  pelaksanaanUjian: string;    // cbt_pelaksanaan_ujian.nama
  kelas: string;               // kelas.nama
  totalPeserta: number;
}

interface ParticipantRow {
  no: number;
  nisn: string;
  namaSiswa: string;
  kelas: string;
  jawabanBenar: number;
  totalSoal: number;
  nilai: number;               // percentage 0-100, 2 decimal
  waktuSubmit: string | null;
  status: string;              // 'submitted' | 'auto_submitted'
  jumlahPelanggaran: number;
  keterangan: string;          // 'Dicurigai' if flagged
}

interface DetailedAnswerRow extends ParticipantRow {
  answers: Record<string, string>;  // Q1: 'A', Q2: 'B', etc.
}

interface AnswerKeyRow {
  nomorSoal: number;
  teksSoal: string;            // truncated to 100 chars
  jawabanBenar: string;        // A/B/C/D/E
}

class ResultExportService {
  // Single session export
  async exportSession(
    tenantId: string,
    sessionId: string,
    options: ExportOptions,
    response: Response,
  ): Promise<void>;

  // Bulk export for Pelaksanaan Ujian
  async exportPelaksanaanUjian(
    tenantId: string,
    pelaksanaanUjianId: string,
    options: ExportOptions,
    response: Response,
  ): Promise<void>;

  // Internal helpers
  private async getSessionData(tenantId: string, sessionId: string): Promise<SessionExportData>;
  private async buildParticipantRows(sessionId: string, includeAnswers: boolean): Promise<ParticipantRow[]>;
  private reverseRandomizationMapping(participantMapping: RandomizationMapping, selectedOption: string, questionId: string): string;
  private generateFilename(session: SessionInfo): string;
  private truncateText(text: string, maxLength: number): string;
}
```

### Access Control Helper

```typescript
interface ExportAccessCheck {
  canAccess: boolean;
  accessPath: 'admin' | 'proctor' | 'guru' | null;
  reason?: string;
}

class ExportAccessService {
  async checkSessionExportAccess(
    userId: string,
    userRole: string,
    tenantId: string,
    sessionId: string,
  ): Promise<ExportAccessCheck>;

  async checkPelaksanaanUjianExportAccess(
    userId: string,
    userRole: string,
    tenantId: string,
  ): Promise<ExportAccessCheck>;
}
```

### Randomization Mapping Structure

The `cbt_exam_participant.randomization_mapping` JSONB stores:

```typescript
interface RandomizationMapping {
  questionOrder: string[];  // Array of question IDs in display order
  optionMappings: {
    [questionId: string]: {
      original: string[];   // ['A', 'B', 'C', 'D', 'E']
      shuffled: string[];   // ['C', 'A', 'E', 'B', 'D']
    };
  };
}
```

To reverse-map a student's answer back to the original option:
1. Get the student's selected option (e.g., 'C')
2. Find its index in `shuffled` array (e.g., index 0)
3. Return the option at the same index in `original` array (e.g., 'A')

---

## Data Models

### Export Data Query

The export service joins multiple tables to gather complete data:

```sql
-- For each participant in a session:
SELECT
  p.id as participant_id,
  sa.nisn,
  s.nama as nama_siswa,
  k.nama as kelas,
  p.score_correct as jawaban_benar,
  p.score_total as total_soal,
  p.score_percentage as nilai,
  p.submitted_at as waktu_submit,
  p.status,
  p.violation_count as jumlah_pelanggaran,
  p.is_flagged_cheating,
  p.randomization_mapping
FROM cbt_exam_participant p
JOIN cbt_siswa_account sa ON p.siswa_account_id = sa.id
JOIN siswa s ON sa.siswa_id = s.id
JOIN kelas k ON s.kelas_id = k.id
WHERE p.exam_session_id = :sessionId
  AND p.status IN ('submitted', 'auto_submitted')
ORDER BY s.nama ASC;
```

For detailed answers:
```sql
-- Get answers for a participant:
SELECT
  a.question_id,
  a.selected_option
FROM cbt_answer a
WHERE a.participant_id = :participantId;

-- Get question master order:
SELECT
  esq.question_id,
  esq.nomor_urut,
  q.teks_soal,
  q.jawaban_benar
FROM cbt_exam_session_question esq
JOIN cbt_question q ON esq.question_id = q.id
WHERE esq.exam_session_id = :sessionId
ORDER BY esq.nomor_urut ASC;
```

### Excel File Structure

**Single Session Export (Summary)**:
```
Sheet 1: "Hasil Ujian"
┌─────────────────────────────────────────────────────┐
│ Row 1-6: Metadata header                            │
│ - Nama Ujian: Matematika                            │
│ - Tanggal: 15 Januari 2025 08:00 WIB               │
│ - Durasi: 90 menit                                  │
│ - Pelaksanaan: UTS Semester 1 - Pengetahuan        │
│ - Kelas: 7A                                         │
│ - Total Peserta: 32                                 │
├─────────────────────────────────────────────────────┤
│ Row 8: Column headers                               │
│ No | NISN | Nama Siswa | Kelas | Benar | Total |   │
│ Nilai | Waktu Submit | Status | Pelanggaran |      │
│ Keterangan                                          │
├─────────────────────────────────────────────────────┤
│ Row 9+: Data rows sorted by Nama Siswa              │
└─────────────────────────────────────────────────────┘
```

**Single Session Export (Detailed - detail=true)**:
```
Sheet 1: "Hasil Ujian"
┌─────────────────────────────────────────────────────┐
│ (Same as Summary but with additional columns)       │
│ ...| Keterangan | Q1 | Q2 | Q3 | ... | Qn          │
│ Each Qx shows the ORIGINAL answer (A/B/C/D/E/-)     │
└─────────────────────────────────────────────────────┘

Sheet 2: "Kunci Jawaban"
┌─────────────────────────────────────────────────────┐
│ Nomor Soal | Teks Soal (100 char) | Jawaban Benar  │
│ 1          | Berapakah hasil...   | A               │
│ 2          | Jika x = 5, maka...  | C               │
└─────────────────────────────────────────────────────┘
```

**Bulk Export (Pelaksanaan Ujian)**:
```
One sheet per completed session:
- Sheet names: "{mapel} - {kelas}" (max 31 chars)
- Duplicate handling: append " (2)", " (3)" suffix
- Each sheet has same structure as single export
```

---

## API Design

### New Endpoints

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/exam-sessions/:id/export` | Admin, Proctor, Guru | Export single session results |
| GET | `/api/pelaksanaan-ujian/:id/export` | Admin | Bulk export all completed sessions |

### Request/Response Specifications

**GET /api/exam-sessions/:id/export**

Query Parameters:
- `detail` (optional): `true` to include per-question answers

Access Control:
1. Admin_Sekolah: any session in their tenant
2. Proctor: only sessions they are assigned to
3. Guru: sessions for their mapel+kelas (via jadwal_pelajaran)

Response Headers:
```http
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="hasil-ujian_matematika_7a_20250115.xlsx"
Transfer-Encoding: chunked
```

Error Responses:
- 400: "Hasil ujian hanya dapat diekspor untuk sesi yang sudah selesai"
- 403: Forbidden (no valid access path)
- 404: Session not found

**GET /api/pelaksanaan-ujian/:id/export**

Query Parameters:
- `detail` (optional): `true` to include per-question answers on all sheets

Access Control:
- Admin_Sekolah only

Response Headers:
```http
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="hasil-ujian_uts-semester-1-pengetahuan_20250120.xlsx"
```

Error Responses:
- 400: "Tidak ada sesi ujian yang selesai dalam pelaksanaan ujian ini"
- 403: Forbidden
- 404: Pelaksanaan Ujian not found

---

## Key Flows

### Flow 1: Single Session Export

```
1. User clicks "Export Hasil" on completed session
2. Frontend calls GET /api/exam-sessions/:id/export?detail=true
3. Controller checks:
   a. Session exists and belongs to tenant
   b. Session status = 'completed'
   c. User has valid access (Admin > Proctor > Guru)
4. If valid, ResultExportService.exportSession() is called
5. Service:
   a. Loads session metadata (mapel name, kelas name, scheduled_at)
   b. Loads all submitted participants with siswa info
   c. If detail=true, loads answers and question master order
   d. For each participant with randomization:
      - Reverse-map each answer to original option
   e. Creates ExcelJS workbook with streaming
   f. Writes metadata header rows
   g. Writes participant data rows
   h. If detail=true, writes "Kunci Jawaban" sheet
   i. Pipes workbook to response stream
6. Audit log records export event
7. Browser downloads .xlsx file
```

### Flow 2: Bulk Export (Pelaksanaan Ujian)

```
1. Admin clicks "Export Semua Hasil" on Pelaksanaan Ujian
2. Frontend calls GET /api/pelaksanaan-ujian/:id/export?detail=true
3. Controller checks:
   a. Pelaksanaan Ujian exists in tenant
   b. User is Admin_Sekolah
4. Service:
   a. Finds all completed sessions in this Pelaksanaan Ujian
   b. If none, return 400 error
   c. Creates workbook
   d. For each session:
      - Generate sheet name (mapel - kelas, handle duplicates)
      - Add sheet with session data
      - If detail=true, add "Kunci_{sheetName}" sheet
   e. Stream response
5. Audit log records bulk export with session count
```

### Flow 3: Randomization Reversal

```
Given:
  - Student selected 'C' for question Q1
  - Randomization mapping for Q1: {
      original: ['A', 'B', 'C', 'D', 'E'],
      shuffled: ['D', 'B', 'A', 'E', 'C']
    }

Process:
  1. Find index of 'C' in shuffled array: index 4
  2. Get value at index 4 in original array: 'E'
  3. Student's original answer is 'E'

Export shows: Q1 = 'E' (what they actually selected, mapped to original)
```

---

## Error Handling

### Export Errors

| Scenario | Status | Message | Recovery |
|----------|--------|---------|----------|
| Session not completed | 400 | "Hasil ujian hanya dapat diekspor untuk sesi yang sudah selesai" | Wait for completion |
| No access | 403 | "Anda tidak memiliki akses untuk mengekspor hasil ujian ini" | Contact admin |
| Session not found | 404 | "Sesi ujian tidak ditemukan" | Check ID |
| No completed sessions in PU | 400 | "Tidak ada sesi ujian yang selesai dalam pelaksanaan ujian ini" | Wait for sessions to complete |
| Database error | 500 | "Gagal mengekspor hasil ujian" | Retry |
| Stream write error | 500 | Connection closed | Retry download |

### Empty Data Handling

If a session has no submitted participants:
- Export file is still generated
- Contains metadata header
- Row 10: "Tidak ada data submission"
- This is valid (exam cancelled early, all students absent, etc.)

---

## Testing Strategy

### Property-Based Tests (fast-check)

Property-based tests use the fast-check library to generate random inputs and verify correctness properties hold across all cases.

**Configuration**: Minimum 100 iterations per property test.

1. **Property 1: Randomization Reversal**
   - Generate random randomization mappings with shuffled options
   - Generate random answer selections
   - Verify reversal returns correct original option
   - **Tag**: `Feature: cbt-result-export, Property 1: Randomization reversal preserves original answer`

2. **Property 3: Score Percentage Consistency**
   - Generate random (scoreCorrect, scoreTotal) pairs where scoreCorrect <= scoreTotal
   - Verify calculated percentage matches expected value
   - **Tag**: `Feature: cbt-result-export, Property 3: Score percentage consistency`

3. **Property 4: Alphabetical Sort Order**
   - Generate random arrays of participant names
   - Apply sort function
   - Verify output is in ascending order
   - **Tag**: `Feature: cbt-result-export, Property 4: Alphabetical sort order`

4. **Property 5: Sheet Name Uniqueness**
   - Generate random arrays of (mapel, kelas) pairs with duplicates
   - Apply sheet naming function
   - Verify all names are unique and follow suffix pattern
   - **Tag**: `Feature: cbt-result-export, Property 5: Sheet name uniqueness in bulk export`

5. **Property 6: Access Control**
   - Generate random (user, session) pairs with various role combinations
   - Verify access decision matches expected based on role hierarchy
   - **Tag**: `Feature: cbt-result-export, Property 6: Access control hierarchy`

6. **Property 8: Filename Format**
   - Generate random mapel names, kelas names, and dates
   - Apply filename generation
   - Verify output matches regex pattern
   - **Tag**: `Feature: cbt-result-export, Property 8: Filename format compliance`

### Unit Tests (Example-Based)

1. **Randomization reversal edge cases**
   - Unanswered question (null → "-")
   - 4-option vs 5-option questions
   - No randomization (identity mapping)

2. **Filename generation edge cases**
   - Indonesian special characters (é, ü)
   - Very long names (truncation)
   - Empty strings

3. **Sheet name edge cases**
   - Exactly 31 characters (Excel limit)
   - Names with forbidden characters (: / \ ? * [ ])
   - Maximum duplicate count

4. **Empty export**
   - Session with 0 submitted participants
   - Verify "Tidak ada data submission" note

### Integration Tests

1. **Single session export flow**
   - Create session with participants and answers
   - Request export via API
   - Parse response as xlsx
   - Verify all data matches database

2. **Detailed export with Kunci Jawaban**
   - Verify Q columns match question count
   - Verify answer key sheet structure
   - Verify answer mapping through randomization

3. **Bulk export**
   - Create Pelaksanaan Ujian with multiple sessions
   - Request bulk export
   - Verify sheet count and naming

4. **Access control integration**
   - Test Admin access to any session
   - Test Proctor access to assigned session only
   - Test Proctor denied access to other session
   - Test Guru access via jadwal_pelajaran

5. **Audit logging**
   - Verify audit entry created for each export
   - Verify all required fields populated

6. **Error cases**
   - Export non-completed session (400)
   - Export without access (403)
   - Bulk export with no completed sessions (400)

### Performance Tests

1. **Large session export**
   - 500 participants
   - Target: < 30 seconds
   - Monitor memory (should not exceed 256MB)

2. **Bulk export**
   - 50 sessions × 500 participants = 25,000 rows
   - Target: < 60 seconds
   - Verify streaming (chunked transfer)

3. **Concurrent exports**
   - 10 simultaneous export requests
   - No degradation or errors

---

## Frontend Integration

### Admin Dashboard Changes

**ExamSessionListView.vue**
- Add export button for `completed` sessions
- Button shows dropdown: "Export" / "Export dengan Detail"

**PelaksanaanUjianView.vue**
- Add "Export Semua Hasil" button
- Shows when at least one completed session exists

### Export Button Component

```vue
<template>
  <div class="relative" v-if="session.status === 'completed'">
    <button
      @click="showMenu = !showMenu"
      class="rounded-md p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600"
      title="Export hasil"
    >
      <DownloadIcon class="h-4 w-4" />
    </button>
    <div v-if="showMenu" class="absolute right-0 mt-1 w-48 bg-white shadow-lg rounded-md border">
      <button @click="exportSummary" class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">
        Export Ringkasan
      </button>
      <button @click="exportDetailed" class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">
        Export dengan Detail Jawaban
      </button>
    </div>
  </div>
</template>
```

### API Client

```typescript
// apps/admin/src/api/cbt.ts

export async function exportSessionResults(
  sessionId: string, 
  detail: boolean = false
): Promise<void> {
  const url = `/api/exam-sessions/${sessionId}/export${detail ? '?detail=true' : ''}`;
  const response = await api.get(url, { responseType: 'blob' });
  
  // Extract filename from Content-Disposition header
  const disposition = response.headers['content-disposition'];
  const filename = disposition?.match(/filename="(.+)"/)?.[1] || 'hasil-ujian.xlsx';
  
  // Trigger download
  const blob = new Blob([response.data], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function exportPelaksanaanUjianResults(
  pelaksanaanUjianId: string,
  detail: boolean = false
): Promise<void> {
  const url = `/api/pelaksanaan-ujian/${pelaksanaanUjianId}/export${detail ? '?detail=true' : ''}`;
  // Same blob handling as above
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Randomization Reversal Preserves Original Answer

*For any* participant with randomization enabled, and *for any* question they answered, the reverse-mapped answer in the export SHALL equal the original option letter that corresponds to their selected shuffled option.

Given a shuffled option selection and a randomization mapping, the reversal function must return the original option at the same index position.

**Validates: Requirement 4.6**

### Property 2: Export Row Count Matches Submitted Participants

*For any* completed exam session, the number of data rows in the export (excluding header and metadata rows) SHALL equal the count of participants with status 'submitted' or 'auto_submitted'.

**Validates: Requirement 2.3, Requirement 2.6**

### Property 3: Score Percentage Consistency

*For any* participant row in the export, the Nilai (percentage) value SHALL equal `round((scoreCorrect / scoreTotal) * 100, 2)`.

This property ensures data integrity between the database score values and the exported representation.

**Validates: Requirement 2.5**

### Property 4: Alphabetical Sort Order

*For any* export with 2 or more participant rows, the rows SHALL be sorted by Nama Siswa in ascending alphabetical order (locale-sensitive Indonesian sorting).

**Validates: Requirement 2.6**

### Property 5: Sheet Name Uniqueness in Bulk Export

*For any* bulk export of a Pelaksanaan Ujian with N completed sessions, the workbook SHALL contain exactly N sheets, and all sheet names SHALL be unique. When the same mapel+kelas combination appears multiple times, subsequent occurrences SHALL have numeric suffixes " (2)", " (3)", etc.

**Validates: Requirement 5.3, Requirement 5.4**

### Property 6: Access Control Hierarchy

*For any* export request with (userId, userRole, tenantId, sessionId), the system SHALL grant access if and only if at least one of these conditions holds:
1. userRole is Admin_Sekolah AND session.tenantId equals tenantId
2. userId equals session.proctorId
3. userRole is Guru AND there exists a jadwal_pelajaran entry matching (tenantId, session.mataPelajaranId, session.kelasId, session.tahunAjaranId)

Access is denied (403) only when none of these paths are valid.

**Validates: Requirement 3.1, Requirement 3.2, Requirement 3.3, Requirement 3.4**

### Property 7: Detailed Export Question Coverage

*For any* detailed export (detail=true) of a session with N questions:
- The data rows SHALL contain exactly N additional columns (Q1 through QN)
- The "Kunci Jawaban" sheet SHALL contain exactly N data rows
- The Q column order SHALL match the nomor_urut from cbt_exam_session_question

**Validates: Requirement 4.2, Requirement 4.3, Requirement 4.5**

### Property 8: Filename Format Compliance

*For any* single session export, the filename SHALL match the regex pattern:
`hasil-ujian_[a-z0-9-]+_[a-z0-9-]+_\d{8}\.xlsx`

Where the mapel and kelas segments have special characters (spaces, punctuation) replaced with hyphens and converted to lowercase.

**Validates: Requirement 2.8**

### Property 9: Audit Log Completeness

*For any* successful export request, the audit log SHALL contain an entry with:
- actorId matching the requesting user
- resourceType = 'exam_session_export' or 'pelaksanaan_ujian_export'
- resourceId matching the session or Pelaksanaan Ujian ID
- metadata containing IP address and export type (summary/detail)

For bulk exports, metadata SHALL also include the count of sessions exported.

**Validates: Requirement 3.6, Requirement 3.7, Requirement 5.8**

### Property 10: Response Headers Correctness

*For any* export response, the headers SHALL include:
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="..."` with RFC 5987 encoded filename

**Validates: Requirement 8.5**

---

## Out of Scope

Per the requirements document:
1. Re-enabling Score Push later (separate feature if needed)
2. Automatic export scheduling (on-demand only)
3. Export formats other than Excel (.xlsx)
4. Historical data migration for already-pushed scores
5. Siswa access to export functionality

---

## Dependencies

### New Dependencies

```json
// apps/api/package.json
{
  "dependencies": {
    "exceljs": "^4.4.0"
  }
}
```

### Module Dependencies

- ResultExportModule depends on:
  - DrizzleModule (database queries)
  - AuditLogModule (export event logging)
  - No external service dependencies

---

## Migration Plan

### Phase 1: Add Export Module (Non-Breaking)
1. Install exceljs dependency
2. Create ResultExportModule with service and controller
3. Add new API endpoints
4. Add frontend export buttons
5. Deploy and test

### Phase 2: Remove Score Push Module
1. Remove ScorePushModule import from app.module.ts
2. Delete apps/api/src/modules/score-push/ directory
3. Update design document Flow 4
4. Remove raporNilai from lms-tables.ts (check if used elsewhere first)
5. Deploy

This phased approach ensures export functionality is working before removing the old code.
