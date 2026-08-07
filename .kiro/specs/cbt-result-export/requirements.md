# Requirements Document

## Introduction

This spec describes the replacement of the Score Push Module in CBT Teman Sekolah. The current system has a Score Push Module designed to write exam scores directly to the LMS `rapor_nilai` table (Rapor Digital) when admin releases results. However, this tight coupling is not needed — schools want flexibility in how they process CBT results before entering them into their grading system.

The new approach removes the Score Push Module entirely and replaces it with an Excel export feature. Teachers and administrators can download exam results in a structured Excel format, review the data, and manually input scores to their grading system if needed. This decouples CBT from the LMS rapor workflow while still providing all necessary data for grade recording.

**Current State Analysis:**
- Score Push Module exists at `apps/api/src/modules/score-push/` but is NOT currently integrated into the result release flow
- The `releaseResults()` method in `exam-session.service.ts` does NOT call `ScorePushService.pushScores()`
- The module is registered in `app.module.ts` but unused
- This makes removal straightforward — we just need to delete the module and its registration

## Glossary

- **CBT_System**: The CBT Teman Sekolah platform
- **Exam_Session**: A scheduled time window during which students take a specific exam
- **Exam_Result**: The graded outcome of a Siswa's exam participation, including score, correct answers, and submission metadata
- **Result_Export**: An Excel file containing exam results for a completed Exam_Session
- **Admin_Sekolah**: The school-level administrator with full management access to their school's CBT data
- **Proctor**: A staff user assigned to monitor an Exam_Session
- **Guru**: A teacher who creates questions and may need access to exam results for their subjects
- **Siswa**: A student participant in an Exam_Session
- **Score_Push_Module**: The existing module that writes scores to LMS rapor_nilai (to be removed)
- **Export_Service**: The new service that generates Excel exports of exam results
- **Pelaksanaan_Ujian**: An exam period/semester (e.g., "UTS Semester 1 - Pengetahuan") containing multiple Exam_Sessions

## Requirements

### Requirement 1: Remove Score Push Integration

**User Story:** As an Admin Sekolah, I want the CBT system to stop automatically pushing scores to the LMS rapor, so that I have control over when and how exam scores enter the grading system.

#### Acceptance Criteria

1. THE CBT_System SHALL completely remove the Score_Push_Module code including: `score-push.module.ts`, `score-push.service.ts`, `score-push.service.spec.ts`, and the `index.ts` barrel export file
2. THE CBT_System SHALL remove the ScorePushModule import and registration from `app.module.ts`
3. THE CBT_System SHALL NOT write any data to the LMS `rapor_nilai` table when releasing exam results
4. THE CBT_System SHALL retain the `results_released` flag functionality on Exam_Session to control when Siswa can view their results
5. WHEN results are released AND the Score_Push_Module has been completely removed, THE CBT_System SHALL allow Siswa to view their scores according to the configured result_detail_level
6. THE CBT_System SHALL remove the `raporNilai` table reference from `apps/api/src/drizzle/schema/lms-tables.ts` if it is no longer needed by any other module

### Requirement 2: Excel Export of Exam Results

**User Story:** As an Admin Sekolah, I want to download exam results as an Excel file, so that I can review scores and manually input them to the grading system or share with teachers.

#### Acceptance Criteria

1. THE CBT_System SHALL provide an endpoint `GET /api/exam-sessions/:id/export` accessible to Admin_Sekolah and the assigned Proctor
2. WHEN the Admin_Sekolah or Proctor requests an export for a Completed Exam_Session, THE CBT_System SHALL generate an Excel file (.xlsx format) containing the exam results
3. THE Result_Export file SHALL include the following columns: No, NISN, Nama Siswa, Kelas, Jawaban Benar, Total Soal, Nilai (percentage), Waktu Submit, Status (submitted/auto_submitted), Jumlah Pelanggaran (violation_count), and Keterangan (flagged cheating indicator if applicable)
4. THE Result_Export file SHALL include a header section containing metadata: Nama Ujian (mata pelajaran name), Tanggal Ujian (scheduled_at formatted in tenant timezone), Durasi (duration_minutes), Pelaksanaan Ujian (nama from cbt_pelaksanaan_ujian), Kelas, and Total Peserta
5. THE CBT_System SHALL format the Nilai column as a number between 0 and 100 with 2 decimal places (raw percentage, not scaled)
6. THE CBT_System SHALL sort the export data by Nama Siswa in ascending alphabetical order
7. IF the Exam_Session has no participants OR no participants have submitted, THEN THE CBT_System SHALL return an empty export with headers only and a note in cell A10 indicating "Tidak ada data submission"
8. THE Result_Export filename SHALL follow the pattern: `hasil-ujian_{mata-pelajaran}_{kelas}_{tanggal}.xlsx` where tanggal is formatted as YYYYMMDD and special characters are replaced with hyphens
9. THE CBT_System SHALL use a library like `exceljs` or `xlsx` to generate proper .xlsx files with formatted headers and column widths

### Requirement 3: Export Access Control

**User Story:** As a Proctor, I want to download results for exam sessions I monitored, so that I can review student performance and prepare reports.

#### Acceptance Criteria

1. THE CBT_System SHALL allow the assigned Proctor of an Exam_Session to access the export endpoint for that session
2. THE CBT_System SHALL allow Admin_Sekolah to access the export endpoint for any Exam_Session within their Tenant
3. THE CBT_System SHALL allow Guru to access the export endpoint for Exam_Sessions of their assigned mata_pelajaran and kelas (derived from jadwal_pelajaran)
4. THE CBT_System SHALL check access authorization in sequence: Admin_Sekolah first, then Proctor, then Guru — and return 403 Forbidden only if none of these access paths are valid
5. IF a user attempts to export results for an Exam_Session that is not in Completed status, THEN THE CBT_System SHALL return a 400 Bad Request response with message "Hasil ujian hanya dapat diekspor untuk sesi yang sudah selesai"
6. THE Audit_Log SHALL record each export request with: actor identity (user_id), actor role, Exam_Session identifier, export type (summary/detail), and timestamp
7. THE CBT_System SHALL include the export request IP address in the audit log metadata

### Requirement 4: Export with Detailed Answer Data

**User Story:** As an Admin Sekolah, I want the option to export detailed per-question answers, so that teachers can analyze student performance on specific questions.

#### Acceptance Criteria

1. THE CBT_System SHALL support an optional query parameter `detail=true` on the export endpoint
2. WHEN `detail=true` is specified, THE Result_Export SHALL include both the summary columns (from Requirement 2) AND additional columns for each question: Q1, Q2, Q3... Qn showing the Siswa's selected answer (A/B/C/D/E or "-" if unanswered)
3. WHEN `detail=true` is specified, THE Result_Export SHALL include a second sheet named "Kunci Jawaban" containing: Nomor Soal, Teks Soal (truncated to 100 characters with "..." suffix if truncated), and Jawaban Benar
4. WHEN `detail=true` is NOT specified, THE Result_Export SHALL contain only the summary columns defined in Requirement 2
5. THE CBT_System SHALL use the question order as stored in cbt_exam_session_question (the master order at packaging time, not the randomized per-student order) when generating the Q1, Q2... columns
6. THE CBT_System SHALL map each student's answer back to the original option letter using the `randomization_mapping` stored in cbt_exam_participant before writing to the export

### Requirement 5: Bulk Export for Pelaksanaan Ujian

**User Story:** As an Admin Sekolah, I want to export results for all exam sessions in a Pelaksanaan Ujian at once, so that I can efficiently prepare grades for an entire exam period.

#### Acceptance Criteria

1. THE CBT_System SHALL provide an endpoint `GET /api/pelaksanaan-ujian/:id/export` accessible to Admin_Sekolah only
2. WHEN the Admin_Sekolah requests a bulk export AND at least one Completed Exam_Session exists within the Pelaksanaan_Ujian, THE CBT_System SHALL proceed with generating the Excel file
3. THE bulk Result_Export SHALL create one sheet per Exam_Session, with sheet names formatted as "{mata-pelajaran} - {kelas}" (truncated to 31 characters for Excel sheet name limit)
4. THE CBT_System SHALL handle duplicate sheet names by appending a numeric suffix (e.g., "Matematika - 7A (2)") when the same mata_pelajaran + kelas combination appears more than once
5. IF a Pelaksanaan_Ujian has no Completed Exam_Sessions, THEN THE CBT_System SHALL return a 400 Bad Request response with message "Tidak ada sesi ujian yang selesai dalam pelaksanaan ujian ini"
6. THE bulk export filename SHALL follow the pattern: `hasil-ujian_{pelaksanaan-ujian-nama}_{tanggal-export}.xlsx` where tanggal-export is formatted as YYYYMMDD
7. THE CBT_System SHALL support an optional `detail=true` query parameter for bulk export, applying detailed answer columns to all sheets
8. THE Audit_Log SHALL record each bulk export with: actor identity, Pelaksanaan_Ujian identifier, count of sessions exported, and timestamp

### Requirement 6: Frontend Integration for Export

**User Story:** As an Admin Sekolah, I want to easily access export functionality from the admin dashboard, so that I can download results without needing to know API endpoints.

#### Acceptance Criteria

1. THE Admin Dashboard SHALL add an "Export Hasil" button on the Exam Session detail view for Completed sessions
2. THE Admin Dashboard SHALL add an "Export Semua Hasil" button on the Pelaksanaan Ujian list/detail view
3. THE export buttons SHALL include a checkbox or toggle option for "Sertakan detail jawaban per soal"
4. WHEN the user clicks an export button, THE CBT_System SHALL trigger a file download in the browser
5. THE Admin Dashboard SHALL show a loading indicator while the export is being generated
6. IF the export fails, THE Admin Dashboard SHALL show an appropriate error message to the user

### Requirement 7: Update Design Document and Tasks

**User Story:** As a developer, I want the design document to reflect the removal of Score Push and addition of Export functionality, so that the documentation remains accurate.

#### Acceptance Criteria

1. THE design document Flow 4 "Score Push to LMS Rapor" SHALL be replaced with "Result Export to Excel" describing the new export flow
2. THE design document API Design section SHALL remove the score push trigger description from `/api/exam-sessions/:id/release-results`
3. THE design document SHALL add new API endpoints: `GET /api/exam-sessions/:id/export` and `GET /api/pelaksanaan-ujian/:id/export` with their descriptions
4. THE Architecture Overview diagram SHALL remove the Score_Push module box and show Export_Service in its place
5. THE tasks.md file SHALL have Task 13 (Score Push Module) updated to reflect removal rather than implementation


### Requirement 8: Performance and File Size Considerations

**User Story:** As an Admin Sekolah with large exam sessions, I want the export to handle hundreds of participants without timing out, so that I can reliably download complete results.

#### Acceptance Criteria

1. THE CBT_System SHALL generate exports for sessions with up to 500 participants within 30 seconds
2. THE CBT_System SHALL stream the Excel file response to prevent memory issues with large datasets
3. THE bulk export for Pelaksanaan_Ujian SHALL handle up to 50 Exam_Sessions (approximately 25,000 total participant rows) within 60 seconds
4. IF an export takes longer than 5 seconds, THE CBT_System SHALL use chunked/streaming response to prevent client timeout
5. THE CBT_System SHALL set appropriate response headers: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `Content-Disposition: attachment; filename="..."` with properly encoded filename

## Out of Scope

The following items are explicitly NOT part of this spec:

1. **Re-enabling Score Push later** — If the school wants to push scores to LMS in the future, that would be a separate feature request
2. **Automatic export scheduling** — No cron job to auto-generate exports; exports are on-demand only
3. **Export format other than Excel** — CSV, PDF, or other formats are not included
4. **Historical data migration** — Exam sessions that already had scores pushed to LMS before this change are not affected; we do not roll back those scores
5. **Siswa access to export** — Only staff (Admin, Proctor, Guru) can export; Siswa view their individual results via the existing result viewing endpoint
