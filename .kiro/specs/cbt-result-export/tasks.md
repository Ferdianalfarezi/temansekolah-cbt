# Implementation Plan: CBT Result Export

## Overview

This implementation replaces the unused Score Push Module with an Excel export feature. The approach is two-phased: first add the new export functionality, then remove the old score-push code. This ensures export is working before removing any existing code.

The implementation uses `exceljs` for streaming Excel generation, creates a new `ResultExportModule`, and integrates with existing exam-session and pelaksanaan-ujian controllers for the export endpoints.

## Tasks

- [x] 1. Set up ResultExportModule foundation
  - [x] 1.1 Install exceljs dependency and create module structure
    - Run `pnpm add exceljs` in `apps/api`
    - Create directory `apps/api/src/modules/result-export/`
    - Create `result-export.module.ts` with imports for DrizzleModule and AuditLogModule
    - Create `result-export.service.ts` with empty class skeleton
    - Create `result-export.controller.ts` with empty class skeleton
    - Create `dto/export-query.dto.ts` with `detail` boolean parameter
    - Create `index.ts` barrel export
    - Register ResultExportModule in `app.module.ts`
    - _Requirements: 2.9_

  - [ ]* 1.2 Write unit tests for module initialization
    - Test that ResultExportModule compiles and injects dependencies
    - _Requirements: 2.9_

- [x] 2. Implement randomization reversal and helper utilities
  - [x] 2.1 Create randomization reversal function
    - Implement `reverseRandomizationMapping(mapping, selectedOption, questionId)` in service
    - Handle null/undefined answers (return "-")
    - Handle missing mapping (identity return)
    - Support both 4-option and 5-option questions
    - _Requirements: 4.6_

  - [ ]* 2.2 Write property test for randomization reversal
    - **Property 1: Randomization reversal preserves original answer**
    - Generate random shuffled arrays and selections
    - Verify reversal returns correct index mapping
    - **Validates: Requirements 4.6**

  - [x] 2.3 Create filename generation utility
    - Implement `generateFilename(mapelName, kelasName, date)` function
    - Convert special characters to hyphens
    - Convert to lowercase
    - Format date as YYYYMMDD
    - _Requirements: 2.8_

  - [ ]* 2.4 Write property test for filename format
    - **Property 8: Filename format compliance**
    - Generate random mapel/kelas names with special characters
    - Verify output matches regex pattern `hasil-ujian_[a-z0-9-]+_[a-z0-9-]+_\d{8}\.xlsx`
    - **Validates: Requirements 2.8**

  - [x] 2.5 Create sheet name generation utility for bulk export
    - Implement `generateSheetName(mapelName, kelasName, existingNames)` function
    - Truncate to 31 characters (Excel limit)
    - Handle duplicate names with " (2)", " (3)" suffix
    - Remove forbidden characters (: / \ ? * [ ])
    - _Requirements: 5.3, 5.4_

  - [ ]* 2.6 Write property test for sheet name uniqueness
    - **Property 5: Sheet name uniqueness in bulk export**
    - Generate random arrays of (mapel, kelas) pairs with duplicates
    - Verify all generated names are unique
    - Verify suffix pattern is applied correctly
    - **Validates: Requirements 5.3, 5.4**

- [x] 3. Checkpoint - Verify utilities work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement export access control
  - [x] 4.1 Create ExportAccessService with access check logic
    - Create `export-access.service.ts` in result-export module
    - Implement `checkSessionExportAccess(userId, userRole, tenantId, sessionId)`
    - Check Admin_Sekolah access (any session in tenant)
    - Check Proctor access (assigned sessions only via session.proctorId)
    - Check Guru access (via jadwal_pelajaran matching)
    - Return `{ canAccess: boolean, accessPath: string, reason?: string }`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 4.2 Write property test for access control hierarchy
    - **Property 6: Access control hierarchy**
    - Generate random (user, session) pairs with role combinations
    - Verify access decision matches expected hierarchy
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [x] 4.3 Implement pelaksanaan ujian access check
    - Implement `checkPelaksanaanUjianExportAccess(userId, userRole, tenantId)`
    - Only Admin_Sekolah can access bulk export
    - _Requirements: 5.1_

- [x] 5. Implement single session export service
  - [x] 5.1 Create data query methods in ResultExportService
    - Implement `getSessionData(tenantId, sessionId)` to load session metadata
    - Join cbt_exam_session with mata_pelajaran, kelas, cbt_pelaksanaan_ujian
    - Return SessionExportMetadata interface
    - _Requirements: 2.4_

  - [x] 5.2 Implement participant data loading
    - Implement `buildParticipantRows(sessionId, includeAnswers)` method
    - Query cbt_exam_participant joined with cbt_siswa_account, siswa, kelas
    - Filter by status IN ('submitted', 'auto_submitted')
    - Sort by nama_siswa ascending (locale-sensitive)
    - Calculate percentage as `round((scoreCorrect / scoreTotal) * 100, 2)`
    - _Requirements: 2.3, 2.5, 2.6_

  - [ ]* 5.3 Write property test for score percentage consistency
    - **Property 3: Score percentage consistency**
    - Generate random (scoreCorrect, scoreTotal) pairs
    - Verify calculated percentage matches expected formula
    - **Validates: Requirements 2.5**

  - [ ]* 5.4 Write property test for alphabetical sort order
    - **Property 4: Alphabetical sort order**
    - Generate random arrays of participant names
    - Verify output is in ascending alphabetical order
    - **Validates: Requirements 2.6**

  - [x] 5.5 Implement answer data loading for detailed export
    - Query cbt_answer joined with cbt_exam_session_question for question order
    - Load question master data for "Kunci Jawaban" sheet
    - Apply randomization reversal for each participant's answers
    - _Requirements: 4.2, 4.3, 4.5, 4.6_

  - [x] 5.6 Implement Excel workbook generation with streaming
    - Create `exportSession(tenantId, sessionId, options, response)` method
    - Use ExcelJS streaming workbook writer
    - Write metadata header rows (1-6)
    - Write column headers row (8)
    - Write participant data rows (9+)
    - Handle empty data case with "Tidak ada data submission" note
    - _Requirements: 2.2, 2.3, 2.4, 2.7, 8.2, 8.4_

  - [x] 5.7 Add detailed export with answer columns and Kunci Jawaban sheet
    - When detail=true, add Q1...Qn columns after Keterangan
    - Create "Kunci Jawaban" sheet with Nomor Soal, Teks Soal (truncated), Jawaban Benar
    - Truncate teks soal to 100 characters with "..." suffix
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6. Checkpoint - Verify single session export
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement export controller endpoints
  - [x] 7.1 Create single session export endpoint
    - Add `GET /api/exam-sessions/:id/export` route in result-export.controller.ts
    - Apply TenantGuard and RoleGuard
    - Parse `detail` query parameter via ExportQueryDto
    - Validate session exists and is completed (400 if not)
    - Check access via ExportAccessService (403 if denied)
    - Call ResultExportService.exportSession()
    - Set response headers (Content-Type, Content-Disposition)
    - _Requirements: 2.1, 3.5, 8.5_

  - [ ]* 7.2 Write integration tests for single session export
    - Test successful export for Admin_Sekolah
    - Test successful export for assigned Proctor
    - Test 403 for unassigned Proctor
    - Test 400 for non-completed session
    - Test 404 for non-existent session
    - Test empty export with no participants
    - _Requirements: 2.1, 2.7, 3.1, 3.2, 3.5_

  - [x] 7.3 Implement audit logging for exports
    - Log export event with actorId, actorRole, sessionId, exportType (summary/detail)
    - Include request IP address in metadata
    - Use AuditLogService.log()
    - _Requirements: 3.6, 3.7_

  - [ ]* 7.4 Write property test for audit log completeness
    - **Property 9: Audit log completeness**
    - Verify each export creates audit entry with required fields
    - **Validates: Requirements 3.6, 3.7**

- [x] 8. Implement bulk export for Pelaksanaan Ujian
  - [x] 8.1 Implement bulk export service method
    - Create `exportPelaksanaanUjian(tenantId, puId, options, response)` method
    - Query all completed sessions in the Pelaksanaan Ujian
    - Return 400 if no completed sessions exist
    - Generate sheet name for each session using utility
    - Create one sheet per session with same structure as single export
    - If detail=true, add Kunci Jawaban sheets for each session
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.7_

  - [x] 8.2 Create bulk export endpoint
    - Add `GET /api/pelaksanaan-ujian/:id/export` route
    - Apply TenantGuard and RoleGuard (Admin_Sekolah only)
    - Parse `detail` query parameter
    - Validate Pelaksanaan Ujian exists (404 if not)
    - Check for completed sessions (400 if none)
    - Call ResultExportService.exportPelaksanaanUjian()
    - Set response headers with bulk export filename
    - Log to audit with session count in metadata
    - _Requirements: 5.1, 5.5, 5.6, 5.8_

  - [ ]* 8.3 Write integration tests for bulk export
    - Test successful bulk export for Admin_Sekolah
    - Test 403 for non-admin roles
    - Test 400 for Pelaksanaan Ujian with no completed sessions
    - Test sheet naming with duplicates
    - Test detail=true adds all sheets correctly
    - _Requirements: 5.1, 5.5_

- [x] 9. Checkpoint - Verify all export functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement frontend export buttons
  - [x] 10.1 Add API client methods for export
    - Create `exportSessionResults(sessionId, detail)` in `apps/admin/src/api/cbt.ts`
    - Create `exportPelaksanaanUjianResults(puId, detail)` function
    - Handle blob response and trigger file download
    - Extract filename from Content-Disposition header
    - _Requirements: 6.4_

  - [x] 10.2 Add export button to ExamSession detail/list view
    - Add "Export Hasil" dropdown button for completed sessions
    - Options: "Export Ringkasan", "Export dengan Detail Jawaban"
    - Show loading indicator during export
    - Display error message on failure
    - _Requirements: 6.1, 6.3, 6.5, 6.6_

  - [x] 10.3 Add bulk export button to PelaksanaanUjian view
    - Add "Export Semua Hasil" button
    - Show only when at least one completed session exists
    - Include detail toggle option
    - Show loading indicator and error handling
    - _Requirements: 6.2, 6.3, 6.5, 6.6_

- [x] 11. Remove Score Push Module (Phase 2)
  - [x] 11.1 Remove ScorePushModule from app.module.ts
    - Remove import statement for ScorePushModule
    - Remove ScorePushModule from imports array
    - _Requirements: 1.2_

  - [x] 11.2 Delete score-push module directory
    - Delete `apps/api/src/modules/score-push/score-push.module.ts`
    - Delete `apps/api/src/modules/score-push/score-push.service.ts`
    - Delete `apps/api/src/modules/score-push/score-push.service.spec.ts`
    - Delete `apps/api/src/modules/score-push/index.ts`
    - Remove the entire `score-push/` directory
    - _Requirements: 1.1_

  - [x] 11.3 Clean up unused LMS table references
    - Check if `raporNilai` in `lms-tables.ts` is used by any other module
    - If not used elsewhere, remove the raporNilai table definition
    - Also check `rapor`, `komponenPenilaian`, `jadwalPelajaran` for usage outside score-push
    - Keep any tables that are still used by other modules
    - _Requirements: 1.6_

  - [ ]* 11.4 Write verification tests for module removal
    - Verify app compiles without ScorePushModule
    - Verify result release flow still works without score push
    - Verify Siswa can still view results when results_released=true
    - _Requirements: 1.3, 1.4, 1.5_

- [x] 12. Final checkpoint - Complete system verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation follows a two-phase approach: add export first (tasks 1-10), then remove score-push (task 11)
- Property tests use `fast-check` library with minimum 100 iterations per property

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.3", "2.5"] },
    { "id": 2, "tasks": ["2.2", "2.4", "2.6", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.5"] },
    { "id": 5, "tasks": ["5.3", "5.4", "5.6"] },
    { "id": 6, "tasks": ["5.7", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3"] },
    { "id": 8, "tasks": ["7.4", "8.1"] },
    { "id": 9, "tasks": ["8.2"] },
    { "id": 10, "tasks": ["8.3", "10.1"] },
    { "id": 11, "tasks": ["10.2", "10.3"] },
    { "id": 12, "tasks": ["11.1"] },
    { "id": 13, "tasks": ["11.2"] },
    { "id": 14, "tasks": ["11.3"] },
    { "id": 15, "tasks": ["11.4"] }
  ]
}
```
