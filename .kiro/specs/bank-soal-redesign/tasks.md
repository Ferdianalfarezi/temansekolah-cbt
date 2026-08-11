# Implementation Plan: Bank Soal Redesign

## Overview

Implementasi redesain arsitektur Bank Soal untuk sistem CBT Teman Sekolah. Mengubah struktur data dari flat table (`cbt_question`) menjadi hierarki **Bank Soal → Soal** dengan entitas kontainer yang mengelompokkan soal berdasarkan mata pelajaran dan target kelas.

Pendekatan implementasi:
1. Database schema dan migrasi terlebih dahulu (foundation)
2. Backend module dengan validasi dan business logic
3. Migration script untuk data existing
4. Frontend views dan components
5. Integration testing

## Tasks

- [x] 1. Database Schema Setup
  - [x] 1.1 Create `cbt_bank_soal` table schema in Drizzle
    - Define table with all columns: id, tenantId, pelaksanaanUjianId, mataPelajaranId, createdBy, nama, tingkat, durasiMenit, kkm, shuffleQuestions, shuffleOptions, status, timestamps
    - Add status enum: draft, ready, archived
    - Add CHECK constraints for durasi (5-360) and kkm (0-100)
    - Add indexes for tenant+pelaksanaan and tenant+mapel
    - _Requirements: 1.6, 1.7, 1.8_

  - [x] 1.2 Create `cbt_bank_soal_kelas` junction table schema
    - Define table with id, bankSoalId (FK with CASCADE delete), kelasId
    - Add unique constraint on (bankSoalId, kelasId)
    - Add index on bankSoalId
    - _Requirements: 1.4, 1.5_

  - [x] 1.3 Update `cbt_question` table schema
    - Add bankSoalId column (nullable initially, FK with CASCADE delete)
    - Make mataPelajaranId nullable (for deprecation)
    - Add index on bankSoalId + nomorUrut
    - Keep existing CHECK constraints for text lengths and jawaban validation
    - _Requirements: 2.6, 2.7_

  - [x] 1.4 Generate and run database migration
    - Run `pnpm --filter @edu/api db:generate` to create migration files
    - Verify migration SQL is correct
    - Run `pnpm --filter @edu/api db:migrate`
    - _Requirements: 8.1_

- [x] 2. Checkpoint - Verify database schema
  - Ensure all tables created correctly, ask the user if questions arise.

- [x] 3. Backend BankSoal Module - Core CRUD
  - [x] 3.1 Create module structure and DTOs
    - Create `apps/api/src/modules/bank-soal/` directory structure
    - Create `bank-soal.module.ts` with imports
    - Create `CreateBankSoalDto` with validation decorators (nama, mataPelajaranId, tingkat?, targetKelasIds?, durasiMenit, kkm, shuffleQuestions?, shuffleOptions?)
    - Create `UpdateBankSoalDto` (nama?, tingkat?, targetKelasIds?, durasiMenit?, kkm?, shuffleQuestions?, shuffleOptions? - NO mataPelajaranId)
    - Create `ListBankSoalQueryDto` with filter params (mataPelajaranId?, tingkat?, search?, page, limit)
    - _Requirements: 1.1, 1.6, 1.7, 5.1, 5.3_

  - [x] 3.2 Implement BankSoalService - scope validation helpers
    - Implement `getGuruScope(userId, tenantId)` - query jadwal_pelajaran to get allowed mataPelajaranIds and kelasIds
    - Implement `validateGuruScope(userId, tenantId, mataPelajaranId, kelasIds?)` - throw ForbiddenException if out of scope
    - Implement `checkBankSoalLocked(bankSoalId)` - check if any exam_session has status in ['packaged', 'active', 'completed']
    - Implement `checkBankSoalUsedInAnySession(bankSoalId)` - check if any exam_session references this bank soal
    - _Requirements: 1.2, 1.3, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 3.3 Write property test for Guru Scope Filtering
    - **Property 1: Guru Scope Filtering**
    - Test that available mata_pelajaran and kelas options match jadwal_pelajaran assignments
    - Test that accessible bank soal list contains only items where Guru teaches the mapel OR created the bank soal
    - **Validates: Requirements 1.2, 1.3, 4.1, 9.1-9.5**

  - [x] 3.4 Implement BankSoalService - create operation
    - Get active pelaksanaan_ujian for tenant, throw NotFoundException if none
    - Validate guru scope for mataPelajaranId
    - Validate guru scope for targetKelasIds (if provided)
    - Handle tingkat vs targetKelasIds precedence (targetKelasIds wins if both provided)
    - Insert cbt_bank_soal with status='draft'
    - Insert cbt_bank_soal_kelas for each targetKelasId (within transaction)
    - _Requirements: 1.1, 1.4, 1.5, 1.8, 1.9_

  - [ ]* 3.5 Write property test for Target Kelas Precedence
    - **Property 2: Target Kelas Precedence**
    - Test that when both tingkat and targetKelasIds provided, only targetKelasIds is used
    - Test that when only tingkat provided, bank soal applies to all kelas in that tingkat
    - **Validates: Requirements 1.4, 1.5**

  - [ ]* 3.6 Write property tests for validation
    - **Property 3: Duration Validation** - Test valid durasi [5,360] accepted, outside rejected
    - **Property 4: KKM Validation** - Test valid kkm [0,100] accepted, outside rejected
    - **Property 5: Bank Soal Creation Defaults** - Test created bank soal has status='draft' and correct pelaksanaan_ujian_id
    - **Validates: Requirements 1.6, 1.7, 1.8, 5.2**

  - [x] 3.7 Implement BankSoalService - read operations
    - Implement `findAll(tenantId, userId, query)` - filter by scope, mapel, tingkat, search; return paginated results with soal count
    - Implement `findOne(tenantId, userId, id)` - validate scope, return bank soal with all soal ordered by nomorUrut
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 3.8 Write property test for Filter Returns Matching Results
    - **Property 15: Filter Returns Matching Results**
    - Test that all returned items match the filter criteria (mataPelajaranId, tingkat, search)
    - **Validates: Requirements 4.3, 4.4, 4.5**

  - [x] 3.9 Implement BankSoalService - update operation
    - Check if bank soal is locked (used in packaged/active/completed session), reject if locked
    - Validate mataPelajaranId is not changed (reject if different)
    - Validate guru scope for new targetKelasIds (if changed)
    - Update bank soal record
    - Update cbt_bank_soal_kelas (delete old, insert new) within transaction
    - Update updatedAt timestamp
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 3.10 Write property tests for update operations
    - **Property 16: Mata Pelajaran Immutability** - Test that changing mataPelajaranId is rejected
    - **Property 17: Update Changes Timestamp** - Test that updatedAt is newer after update
    - **Validates: Requirements 5.3, 5.5**

  - [x] 3.11 Implement BankSoalService - delete operation
    - Check if bank soal is used in ANY exam_session (any status including draft), reject if used
    - Delete bank soal (cascade deletes soal and bank_soal_kelas via FK)
    - Create audit log with bank soal info and soal count
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 3.12 Write property tests for delete operations
    - **Property 18: Cascade Delete** - Test that deleting bank soal also deletes all soal
    - **Property 19: Delete Protection** - Test that bank soal used in any session cannot be deleted
    - **Property 20: Delete Audit Logging** - Test that audit log is created on deletion
    - **Validates: Requirements 6.2, 6.3, 6.4**

- [x] 4. Checkpoint - Verify CRUD operations
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Backend BankSoal Module - Soal Management
  - [x] 5.1 Create Soal DTOs
    - Create `CreateSoalDto` with validation (teksSoal, opsiA-D required, opsiE optional, jawabanBenar, gambar URLs optional)
    - Create `UpdateSoalDto` with same fields as optional
    - Add validation for text lengths (teksSoal 1-2000, opsi 1-500)
    - Add custom validator for opsiE requirement when jawabanBenar='E'
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [x] 5.2 Implement BankSoalService - soal CRUD
    - Implement `addSoal(tenantId, userId, bankSoalId, dto)` - validate scope, check not locked, create soal with bank_soal_id
    - Implement `updateSoal(tenantId, userId, bankSoalId, soalId, dto)` - check lock FIRST (before field validation), then update
    - Implement `removeSoal(tenantId, userId, bankSoalId, soalId)` - check lock FIRST, show confirmation message in frontend
    - _Requirements: 2.1, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [ ]* 5.3 Write property tests for Soal management
    - **Property 6: Answer E Requires Option E** - Test jawabanBenar='E' only valid when opsiE is non-empty 1-500 chars
    - **Property 7: Text Length Validation** - Test teksSoal 1-2000, opsi 1-500 validation
    - **Property 8: Soal Inherits Bank Soal Reference** - Test new soal gets correct bank_soal_id, updates preserve it
    - **Property 9: Delete Removes Record** - Test deleted soal returns null
    - **Property 10: Lock Mechanism** - Test locked bank soal rejects all edit/delete on soal
    - **Validates: Requirements 2.3-2.9**

- [x] 6. Backend BankSoal Module - Bulk Import
  - [x] 6.1 Implement Excel template generation
    - Create endpoint `GET /bank-soal/template` to download Excel template
    - Template columns: nomor_soal, teks_soal, jawaban_benar, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e
    - Include example rows with valid data
    - _Requirements: 3.5_

  - [x] 6.2 Implement Excel import with preview
    - Implement `parseExcel(file)` - parse Excel buffer, extract rows into structured data
    - Validate required columns exist
    - Validate each row: non-empty teksSoal, valid jawabanBenar (A-E), non-empty opsiA-D, opsiE required if jawabanBenar=E
    - Return preview with valid rows and error list with row numbers
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 6.3 Implement bulk import confirmation
    - Implement `importSoal(tenantId, userId, bankSoalId, file)` 
    - Check bank soal not locked
    - Parse and validate Excel
    - If all rows invalid, return BadRequestException with all errors
    - Insert all valid soal in single transaction (all or nothing)
    - All created soal get same bank_soal_id
    - _Requirements: 3.4_

  - [ ]* 6.4 Write property tests for Excel import
    - **Property 11: Excel Parsing Round-Trip** - Test serialize/parse preserves data
    - **Property 12: Excel Schema Validation** - Test missing columns reported
    - **Property 13: Import Error Reporting** - Test invalid rows return row-specific errors
    - **Property 14: Bulk Import Same Bank Soal ID** - Test all imported soal have same bank_soal_id
    - **Validates: Requirements 3.1-3.4**

- [x] 7. Backend BankSoal Module - Advanced Operations
  - [x] 7.1 Implement duplicate operation
    - Implement `duplicate(tenantId, userId, id)`
    - Create new bank soal with nama = "{original} (Copy)", status = 'draft'
    - Copy all settings (mataPelajaranId, tingkat, durasiMenit, kkm, shuffle options)
    - Copy all cbt_bank_soal_kelas entries
    - Copy all soal with new IDs and new bank_soal_id
    - All within transaction
    - Return immediately with link to new bank soal (background copy for large datasets)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 7.2 Write property test for duplication
    - **Property 23: Duplication Preserves Data**
    - Test name format, settings preserved, status is draft, soal count matches
    - **Validates: Requirements 10.1-10.4**

  - [x] 7.3 Implement schedule exam operation
    - Create `ScheduleExamDto` with scheduledAt, kelasId, proctorId (optional)
    - Implement `scheduleExam(tenantId, userId, id, dto)`
    - Check bank soal has at least 1 soal, return BadRequestException if empty
    - Validate kelasId is in bank soal's target kelas
    - Create cbt_exam_session with settings from bank soal (durasi, shuffle options, mata_pelajaran_id)
    - Copy all soal to cbt_exam_session_question with nomorUrut
    - Set exam_session status = 'draft', bank_soal_id = source bank soal
    - Return created session
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 7.4 Write property test for exam session creation
    - **Property 21: Exam Session Inherits Settings**
    - Test session has correct duration, shuffle settings, mata_pelajaran, and question count
    - **Validates: Requirements 7.2, 7.3, 7.4**

- [x] 8. Backend BankSoal Module - Controller
  - [x] 8.1 Create BankSoalController with all endpoints
    - POST `/bank-soal` - create bank soal
    - GET `/bank-soal` - list with filters
    - GET `/bank-soal/:id` - get detail with soal list
    - PATCH `/bank-soal/:id` - update settings
    - DELETE `/bank-soal/:id` - delete bank soal
    - POST `/bank-soal/:id/duplicate` - duplicate
    - POST `/bank-soal/:id/schedule` - create exam session
    - POST `/bank-soal/:id/soal` - add soal
    - PATCH `/bank-soal/:id/soal/:soalId` - update soal
    - DELETE `/bank-soal/:id/soal/:soalId` - delete soal
    - POST `/bank-soal/:id/soal/import` - bulk import
    - GET `/bank-soal/template` - download template
    - Apply Guru role guard and scope validation to all endpoints
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 10.1_

  - [x] 8.2 Register BankSoalModule in AppModule
    - Import BankSoalModule in app.module.ts
    - Ensure proper dependency injection for ExamSessionService
    - _Requirements: All_

- [x] 9. Checkpoint - Verify backend module
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Data Migration Script
  - [x] 10.1 Create migration script for existing data
    - Create `apps/api/src/drizzle/migrations/migrate-to-bank-soal.ts`
    - Query unique combinations of (pelaksanaan_ujian_id, mata_pelajaran_id, tingkat, kelas_id) from cbt_question where bank_soal_id IS NULL
    - For each combination: create cbt_bank_soal with default durasi=60, kkm=70, status='draft'
    - Generate name: "Bank Soal {mapel_nama} - Tingkat {X}" or "Bank Soal {mapel_nama} - {kelas_nama}"
    - If kelas_id exists, add entry to cbt_bank_soal_kelas
    - Update all matching cbt_question with the new bank_soal_id
    - Log results: {bankSoalCount} bank soal created, {questionCount} questions updated
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 10.2 Write property test for migration data integrity
    - **Property 22: Migration Data Integrity**
    - Test: count of bank_soal equals unique combinations
    - Test: all questions have non-null bank_soal_id after migration
    - Test: all migrated bank_soal have durasi=60, kkm=70
    - Test: naming convention followed
    - **Validates: Requirements 8.1-8.4**

  - [x] 10.3 Create CLI command to run migration
    - Add script in package.json: `"db:migrate-bank-soal": "ts-node src/drizzle/migrations/migrate-to-bank-soal.ts"`
    - Make migration idempotent (skip questions already with bank_soal_id)
    - _Requirements: 8.1, 8.5_

- [x] 11. Checkpoint - Verify migration
  - Run migration on test data, verify results, ask the user if questions arise.

- [x] 12. Frontend - Bank Soal List View
  - [x] 12.1 Create BankSoalListView.vue
    - Create `apps/admin/src/views/cbt/BankSoalListView.vue`
    - Display list of bank soal in cards/table with: nama, mata pelajaran, jumlah soal, target kelas, durasi, status, tanggal dibuat
    - Add filters: mata pelajaran dropdown, tingkat dropdown, search input
    - Add "Buat Bank Soal" button
    - Add row actions: Edit, Duplikasi, Jadwalkan Ujian, Hapus
    - Implement pagination
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 12.2 Create BankSoalCard.vue component
    - Display bank soal info in card format
    - Show status badge (draft/ready/archived)
    - Show soal count
    - Show target kelas as chips/tags
    - _Requirements: 4.2_

- [x] 13. Frontend - Bank Soal Form Modal
  - [x] 13.1 Create BankSoalFormModal.vue
    - Create modal for create/edit bank soal
    - Form fields: nama (text), mata pelajaran (dropdown - filtered by guru scope), tingkat (dropdown), target kelas (multi-select - filtered by guru scope), durasi (number input), kkm (number input), shuffle questions (toggle), shuffle options (toggle)
    - Client-side validation: durasi 5-360, kkm 0-100, nama required
    - Handle tingkat vs kelas precedence in UI (disable tingkat when kelas selected, and vice versa)
    - Disable mata pelajaran field in edit mode
    - Show error message if no active pelaksanaan ujian
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.9, 5.1, 5.2, 5.3_

- [x] 14. Frontend - Bank Soal Detail View
  - [x] 14.1 Create BankSoalDetailView.vue
    - Display bank soal info header (nama, mapel, durasi, kkm, target kelas, status)
    - Display soal list with: nomor urut, preview teks soal (truncated), jawaban benar
    - Add "Tambah Soal" button
    - Add "Import dari Excel" button
    - Add row actions for each soal: Edit, Hapus
    - Show edit/delete disabled state with tooltip when bank soal is locked
    - Show confirmation dialog before edit/delete with appropriate messages
    - _Requirements: 2.1, 2.9, 2.10_

  - [x] 14.2 Create SoalFormModal.vue
    - Create modal for add/edit soal
    - Form fields: teks soal (textarea), opsi A-D (text inputs, required), opsi E (text input, optional), jawaban benar (radio A-E), gambar URLs (optional)
    - Client-side validation: teks soal 1-2000 chars, opsi 1-500 chars, opsi E required if jawaban=E
    - Disable jawaban=E radio if opsi E is empty
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [x] 15. Frontend - Import and Schedule Modals
  - [x] 15.1 Create ImportSoalModal.vue
    - File upload input for Excel
    - Download template link
    - Preview table showing parsed rows
    - Error list showing invalid rows with row number and error message
    - Confirm import button (disabled if no valid rows)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 15.2 Create ScheduleExamModal.vue
    - Form fields: tanggal dan waktu (datetime picker), kelas peserta (dropdown from bank soal target kelas), proktor (user dropdown, default current user)
    - Show inherited settings: durasi, shuffle options from bank soal
    - Disable submit if bank soal has 0 soal (show warning message)
    - Navigate to exam session detail on success
    - _Requirements: 7.1, 7.2, 7.5_

- [x] 16. Frontend - API Integration
  - [x] 16.1 Create bank-soal API client
    - Create `apps/admin/src/api/bank-soal.ts` with all API methods:
    - createBankSoal(dto), getBankSoalList(query), getBankSoalDetail(id)
    - updateBankSoal(id, dto), deleteBankSoal(id), duplicateBankSoal(id)
    - scheduleExam(id, dto)
    - addSoal(bankSoalId, dto), updateSoal(bankSoalId, soalId, dto), deleteSoal(bankSoalId, soalId)
    - importSoal(bankSoalId, file), downloadTemplate()
    - Handle error responses with appropriate toast messages
    - _Requirements: All_

  - [x] 16.2 Add routes to Vue Router
    - Add route `/cbt/bank-soal` → BankSoalListView
    - Add route `/cbt/bank-soal/:id` → BankSoalDetailView
    - Add to sidebar navigation under CBT menu
    - _Requirements: 4.1_

- [x] 17. Checkpoint - Verify frontend integration
  - Ensure all views work with backend, ask the user if questions arise.

- [ ] 18. Integration Tests
  - [ ]* 18.1 Write CRUD flow integration tests
    - Test complete flow: Create bank soal → Add soal → Edit soal → Delete soal → Delete bank soal
    - Test with real database
    - _Requirements: 1.1, 2.1, 6.1_

  - [ ]* 18.2 Write scope enforcement integration tests
    - Test Guru A cannot access Guru B's mata pelajaran
    - Test Guru cannot see bank soal for kelas they don't teach
    - Test 403 returned for out-of-scope bank soal access
    - _Requirements: 9.1-9.5_

  - [ ]* 18.3 Write lock mechanism integration tests
    - Test: Create bank soal → Create exam session (packaged) → Edit bank soal rejected
    - Test: Create bank soal → Create exam session (active) → Delete soal rejected
    - Test: Create bank soal → Create exam session (draft) → Delete bank soal rejected
    - _Requirements: 2.9, 5.4, 6.3_

- [x] 19. Final Checkpoint - Complete testing
  - Ensure all unit, property, and integration tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout (NestJS backend + Vue 3 frontend)
- Database migrations should be run before backend implementation
- Migration script is idempotent and can be re-run safely
- Lock mechanism checks must happen BEFORE field validation to match requirements

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4"] },
    { "id": 2, "tasks": ["3.1", "3.2"] },
    { "id": 3, "tasks": ["3.3", "3.4"] },
    { "id": 4, "tasks": ["3.5", "3.6", "3.7"] },
    { "id": 5, "tasks": ["3.8", "3.9"] },
    { "id": 6, "tasks": ["3.10", "3.11"] },
    { "id": 7, "tasks": ["3.12", "5.1"] },
    { "id": 8, "tasks": ["5.2"] },
    { "id": 9, "tasks": ["5.3", "6.1"] },
    { "id": 10, "tasks": ["6.2"] },
    { "id": 11, "tasks": ["6.3"] },
    { "id": 12, "tasks": ["6.4", "7.1"] },
    { "id": 13, "tasks": ["7.2", "7.3"] },
    { "id": 14, "tasks": ["7.4", "8.1"] },
    { "id": 15, "tasks": ["8.2"] },
    { "id": 16, "tasks": ["10.1"] },
    { "id": 17, "tasks": ["10.2", "10.3"] },
    { "id": 18, "tasks": ["12.1", "13.1"] },
    { "id": 19, "tasks": ["12.2", "14.1"] },
    { "id": 20, "tasks": ["14.2", "15.1", "15.2"] },
    { "id": 21, "tasks": ["16.1"] },
    { "id": 22, "tasks": ["16.2"] },
    { "id": 23, "tasks": ["18.1", "18.2", "18.3"] }
  ]
}
```
