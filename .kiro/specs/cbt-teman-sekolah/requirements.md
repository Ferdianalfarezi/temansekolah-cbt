# Requirements Document

## Introduction

CBT Teman Sekolah is a multi-tenant Computer-Based Testing platform where each tenant represents a school. Schools independently manage exam schedules, durations, question banks (multiple choice only, text and optional images), and answer keys. The system provides auto-grading, role-based access control across four roles (Superadmin, Admin_Sekolah, Guru, Siswa) with Proctor as a staff capability, anti-cheating enforcement via browser-based restrictions (fullscreen, focus detection, single-session login) and question randomization on student personal devices, and strong audit/security controls particularly around superadmin access to tenant data. The CBT system shares a PostgreSQL database with the existing LMS (Teman Sekolah), reading user, student, class, subject, and schedule data directly from LMS-owned tables while maintaining its own CBT-specific tables for questions, exam sessions, answers, and audit logs. Staff users authenticate via shared JWT tokens issued by the LMS. The student-facing exam interface is delivered as a responsive web application (PWA-capable) optimized for both desktop and mobile browsers.

## Glossary

- **Tenant**: A single school entity within the multi-tenant system, with isolated data from other tenants — corresponds to a row in the shared LMS `tenant` table
- **CBT_System**: The CBT Teman Sekolah platform as a whole
- **LMS**: The existing Learning Management System (Teman Sekolah) that owns user, student, class, and subject data in the shared PostgreSQL database
- **Shared_Database**: The single PostgreSQL instance shared between LMS and CBT_System, where LMS-owned tables are read-only for CBT and CBT-owned tables are exclusive to CBT
- **Superadmin**: The global administrator (Admin Pusat) with read-only access to all tenant data for audit and support purposes — maps to LMS role `super_admin`
- **Admin_Sekolah**: The school-level administrator with full management access to their own school's CBT data — maps to LMS role `admin`
- **Guru**: A teacher who manages questions within their assigned subject and grade scope — maps to LMS role `guru`
- **Siswa**: A student who participates in exam sessions — has a dedicated CBT user account linked to the LMS `siswa` table record
- **Proctor**: A capability (not a distinct role) available to all staff users (Admin_Sekolah, Guru) that enables real-time monitoring of active exam sessions; a specific staff member is assigned as designated Proctor per Exam_Session
- **Exam_Session**: A scheduled time window during which students take a specific exam, belonging to a Pelaksanaan_Ujian
- **Pelaksanaan_Ujian**: An exam administration period that groups multiple Exam_Sessions under a specific tahun_ajaran, periode_rapor, and komponen_penilaian — only one can be active per Tenant at any time
- **Komponen_Penilaian**: An assessment component in the LMS rapor system (e.g., Pengetahuan, Keterampilan) that determines where CBT scores are recorded
- **Periode_Rapor**: A report card period in the LMS (uts_semester_1, semester_1, uts_semester_2, semester_2)
- **Question_Bank_Set**: The logical collection of all questions within a specific Pelaksanaan_Ujian, for a specific mata_pelajaran, scoped to either a tingkat (grade level) or a specific kelas. A Guru creates questions into this logical set. There is no separate "bank" entity — questions are tagged directly with (pelaksanaan_ujian_id, mata_pelajaran_id, tingkat or kelas_id).
- **Audit_Log**: A record of system access events including both read and write operations
- **Session_Package**: The finalized exam session configuration (questions, duration, schedule) that has been locked for administration
- **Answer_Snapshot**: A server-side record of a Siswa's current answers saved periodically during an active Exam_Session
- **CBT_Tenant_Config**: A CBT-owned configuration table per tenant storing timezone, anti-cheat defaults, and other CBT-specific settings not present in the LMS tenant table

## Requirements

### Requirement 1: Multi-Tenant Data Isolation

**User Story:** As an Admin Sekolah, I want my school's data to be completely isolated from other schools, so that no other tenant can access or interfere with our exam content.

#### Acceptance Criteria

1. THE CBT_System SHALL enforce data isolation between Tenants such that queries from one Tenant return only data belonging to that Tenant
2. WHEN a non-Superadmin user authenticates, THE CBT_System SHALL scope all subsequent data access to the single Tenant associated with that user's account
3. IF a non-Superadmin user attempts to access data belonging to a different Tenant, THEN THE CBT_System SHALL deny the request with an authorization error, and log the attempt in the Audit_Log including the actor identity, timestamp, requested resource, and target Tenant identifier
4. THE CBT_System SHALL associate each non-Superadmin user account with exactly one Tenant, and SHALL NOT allow data access without a valid Tenant association

### Requirement 2: Superadmin Read-Only Access

**User Story:** As a Superadmin, I want read-only access to all tenant data including questions and exam data, so that I can monitor readiness and provide technical support without the ability to modify school content.

#### Acceptance Criteria

1. THE CBT_System SHALL grant the Superadmin read access to all Tenant data including Question_Bank content, Exam_Session configurations, and student results
2. THE CBT_System SHALL enforce read-only permissions at the system level for the Superadmin role regarding question content, answer keys, and exam configurations
3. IF the Superadmin attempts to create, update, or delete any Tenant's questions or exam data, THEN THE CBT_System SHALL reject the operation, return an authorization error, and record the rejected attempt in the Audit_Log
4. WHEN the Superadmin accesses any Tenant's data, THE Audit_Log SHALL record the Superadmin identity, timestamp, Tenant identifier, and specific data resources viewed at the individual record level (e.g., each question ID accessed)
5. WHEN the Superadmin accesses a Tenant's data, THE CBT_System SHALL send a persistent in-app notification to the Admin_Sekolah of that Tenant within 60 seconds, containing the Superadmin identity, timestamp, and category of data accessed — the notification SHALL be stored and visible when the Admin_Sekolah next logs in if they are not currently online
6. WHEN the Superadmin accesses questions that belong to an Exam_Session in Draft or Packaged state, THE CBT_System SHALL flag the notification to the Admin_Sekolah as high-priority by displaying it with a distinct visual indicator and requiring explicit acknowledgment before dismissal
7. IF the CBT_System fails to deliver a notification to the Admin_Sekolah within 60 seconds of a Superadmin access event, THEN THE CBT_System SHALL retry delivery up to 3 times at 30-second intervals and record the delivery failure in the Audit_Log

### Requirement 3: Siswa Authentication

**User Story:** As a Siswa, I want to log in to the CBT system using my NISN and password, so that I can access my assigned exams securely.

#### Acceptance Criteria

1. THE CBT_System SHALL create CBT user accounts for Siswa automatically based on active Siswa records in the LMS siswa table, using the Siswa's NISN as the login identifier
2. THE CBT_System SHALL set the default password for new Siswa accounts to the Siswa's tanggal_lahir in DDMMYYYY format (sourced from the LMS siswa table — tanggal_lahir is required and always present for Siswa with non-null NISN)
3. WHEN a Siswa logs in for the first time, THE CBT_System SHALL require the Siswa to change their password before granting access to any Exam_Session
4. THE CBT_System SHALL issue JWT tokens for authenticated Siswa with a validity of 12 hours
5. THE CBT_System SHALL allow Siswa to reset their own password by verifying their NISN and tanggal_lahir, then setting a new password
6. IF a Siswa enters an incorrect password 5 consecutive times, THEN THE CBT_System SHALL lock the account for 15 minutes
7. THE CBT_System SHALL only create accounts for Siswa whose status in the LMS is 'aktif' and who have a non-null NISN
8. THE CBT_System SHALL run a Siswa account synchronization check at minimum once every 24 hours, creating new CBT accounts for Siswa who have since been assigned a non-null NISN with status 'aktif'
9. THE Admin_Sekolah SHALL have the ability to manually trigger Siswa account synchronization for their Tenant
10. IF a Siswa's NISN is modified in the LMS, THE CBT_System SHALL update the Siswa's login identifier on the next sync cycle and notify the Admin_Sekolah of the change
11. THE CBT_System SHALL NOT delete or deactivate a Siswa CBT account if their NISN becomes null in the LMS; instead it SHALL flag the account for Admin_Sekolah review
12. THE Admin_Sekolah SHALL have the ability to reset any Siswa's password within their Tenant, restoring it to the default value (tanggal_lahir in DDMMYYYY format) and setting the must-change-password flag so the Siswa is required to change it on next login

### Requirement 4: Pelaksanaan Ujian (Exam Administration)

**User Story:** As an Admin Sekolah, I want to create an exam administration period linked to a specific academic year and assessment component, so that all exam sessions and questions are organized under a single active examination context.

#### Acceptance Criteria

1. THE Admin_Sekolah SHALL have the ability to create a Pelaksanaan_Ujian by specifying: tahun ajaran (defaults to the active tahun_ajaran from LMS), periode rapor (uts_semester_1, semester_1, uts_semester_2, semester_2), and komponen penilaian (from the LMS komponen_penilaian table for that tenant)
2. THE CBT_System SHALL enforce that at most one Pelaksanaan_Ujian can be active per Tenant at any given time
3. WHEN a Pelaksanaan_Ujian is active, THE CBT_System SHALL allow creation of Exam_Sessions and Question_Banks within the scope of that Pelaksanaan_Ujian
4. WHEN the Admin_Sekolah deactivates a Pelaksanaan_Ujian, THE CBT_System SHALL prevent creation of new Exam_Sessions under it and mark all associated Question_Bank sets as inactive (no longer editable)
5. THE Admin_Sekolah SHALL have the ability to view a list of all Pelaksanaan_Ujian (active and historical) for their Tenant
6. THE CBT_System SHALL display the active Pelaksanaan_Ujian name (combining periode + komponen penilaian name) to Guru when they create or manage questions, so Guru knows which exam context they are working in
7. WHEN a Pelaksanaan_Ujian is deactivated, all associated Exam_Sessions that are still in Draft or Packaged state SHALL be automatically cancelled
8. THE CBT_System SHALL NOT allow deactivation of a Pelaksanaan_Ujian while any associated Exam_Session is in Active state — the Admin_Sekolah must wait for all Active sessions to complete before deactivating
9. THE CBT_System SHALL enforce that no two Pelaksanaan_Ujian within the same Tenant and tahun_ajaran can share the same combination of periode_rapor and komponen_penilaian — each Pelaksanaan_Ujian maps to a unique assessment slot in the rapor

### Requirement 5: Admin Sekolah Exam Session Management

**User Story:** As an Admin Sekolah, I want to manage exam sessions within the active exam administration, scheduling specific exams for specific classes with designated proctors.

#### Acceptance Criteria

1. THE Admin_Sekolah SHALL have the ability to create, view, modify, and cancel Exam_Sessions within the active Pelaksanaan_Ujian
2. WHEN the Admin_Sekolah creates an Exam_Session, THE CBT_System SHALL require: schedule date/time (within the Tenant's configured timezone from CBT_Tenant_Config, minimum 60 minutes in the future), duration (between 5 and 360 minutes inclusive), mata pelajaran, target kelas (one kelas per Exam_Session), and a designated Proctor (staff user)
3. THE Admin_Sekolah SHALL have the ability to batch-create Exam_Sessions for multiple kelas with identical configuration (same mata pelajaran, schedule, duration, proctor, and randomization settings), resulting in one independent Exam_Session per kelas
4. THE CBT_System SHALL automatically assign all active Siswa in the selected kelas to the Exam_Session based on the LMS siswa table (siswa with status 'aktif' and kelas_id matching the selected kelas)
5. THE CBT_System SHALL resolve the Question_Bank_Set for the Exam_Session's kelas as follows: if a kelas-specific set exists for the mata pelajaran within the active Pelaksanaan_Ujian, use it; otherwise, use the tingkat-level set for that mata pelajaran
6. IF the Admin_Sekolah submits an Exam_Session creation or modification request with any required field missing or outside its valid range, THEN THE CBT_System SHALL reject the request and indicate which fields failed validation
7. THE Admin_Sekolah SHALL have the ability to release or withhold exam results on a per-Exam_Session basis
8. WHILE exam results are unreleased for an Exam_Session, THE CBT_System SHALL restrict Siswa from viewing their scores while still showing the session as completed
9. THE CBT_System SHALL use the Tenant's configured timezone (from CBT_Tenant_Config, default 'Asia/Jakarta') for all scheduling and display of exam dates and times
10. WHEN the Admin_Sekolah selects a Proctor who is already assigned to another Exam_Session with an overlapping time window, THE CBT_System SHALL display a warning indicating the scheduling conflict but SHALL NOT prevent the assignment
11. THE CBT_System SHALL assign all questions from the resolved Question_Bank_Set to every Siswa in the Exam_Session — each Siswa receives the same set of questions (no subset selection); only the question order and answer option order are randomized per Siswa as configured in Requirement 17

### Requirement 6: Score Push to LMS Rapor

**User Story:** As an Admin Sekolah, I want exam scores to be automatically written to the LMS rapor system when results are released, so that CBT scores appear in student report cards without manual data entry.

#### Acceptance Criteria

1. WHEN the Admin_Sekolah releases exam results for an Exam_Session, THE CBT_System SHALL write each Siswa's score to the LMS rapor_nilai table, mapped to the komponen_penilaian and periode_rapor configured in the parent Pelaksanaan_Ujian
2. THE CBT_System SHALL format the score as a numeric value (0-100 scale, calculated as percentage of correct answers), scaled to match the komponen_penilaian's skala_min and skala_max in the LMS
3. IF a rapor record does not yet exist for the target kelas/tahun_ajaran/periode, THEN THE CBT_System SHALL create a draft rapor record before inserting scores
4. IF a rapor_nilai record already exists for a Siswa+mata_pelajaran within the target rapor, THEN THE CBT_System SHALL merge the CBT score into the existing komponen_nilai JSONB array — updating only the entry matching the Pelaksanaan_Ujian's komponen_penilaian_id without modifying values for other komponen_penilaian entries
5. IF no rapor_nilai record exists for a Siswa+mata_pelajaran, THEN THE CBT_System SHALL insert a new rapor_nilai record with guru_id set to the Guru assigned to the mata_pelajaran+kelas in jadwal_pelajaran (falling back to the Admin_Sekolah if no guru assignment exists)
6. IF the LMS rapor for the target kelas/tahun_ajaran/periode has already been finalized (status = 'final'), THEN THE CBT_System SHALL reject the score push and notify the Admin_Sekolah that the rapor is locked
7. THE CBT_System SHALL record each score push operation in the Audit_Log with the Exam_Session identifier, number of scores written, and success/failure status
8. IF a score push fails for any reason, THEN THE CBT_System SHALL notify the Admin_Sekolah and allow retry
9. THE CBT_System SHALL use the LMS rapor_nilai upsert constraint (rapor_id, siswa_id, mata_pelajaran_id, tenant_id) for conflict detection, applying a JSONB merge strategy rather than a full row overwrite

### Requirement 7: Teacher Question Management

**User Story:** As a Guru, I want to create and manage multiple-choice questions via manual input or Excel import with preview verification, so that I can efficiently build question banks for exams.

#### Acceptance Criteria

1. THE CBT_System SHALL restrict Guru access to Question_Bank entries within their assigned subject and grade scope only (derived from jadwal_pelajaran in the LMS)
2. THE CBT_System SHALL provide two methods for question creation: manual input via web form, and bulk import via Excel file upload
3. WHEN a Guru initiates question creation, THE CBT_System SHALL require the Guru to first select: target tingkat or specific kelas (multiple kelas selectable), and mata pelajaran
4. WHEN a Guru selects manual input, THE CBT_System SHALL present a form requiring question text (between 1 and 2000 characters), an optional question image attachment (max 2MB, formats: PNG, JPG, WebP), options A through D (each between 1 and 500 characters with optional image per option, option E is optional), and exactly one correct answer designation (A/B/C/D/E)
5. WHEN a Guru selects Excel import, THE CBT_System SHALL accept a single Excel file (.xlsx) upload containing columns: nomor soal, teks soal, jawaban benar (A/B/C/D/E), opsi A, opsi B, opsi C, opsi D, and optionally opsi E — image attachments are NOT supported via Excel import and must be added manually after import
6. WHEN a Guru uploads an Excel file, THE CBT_System SHALL parse the file and display the imported questions in an editable preview UI, allowing the Guru to verify, edit, add, or remove individual questions before saving
7. WHEN the Guru confirms the preview and saves, THE CBT_System SHALL persist all questions to the Question_Bank with the selected mata pelajaran and target kelas/tingkat associations
8. IF a Guru submits a question (manual or from preview) with fewer than 4 answer options, duplicate answer option text, blank question text, or no correct answer designated, THEN THE CBT_System SHALL reject that question and display an error message indicating which validation rule was violated
9. THE CBT_System SHALL enforce that each kelas can have at most one active Question_Bank_Set per mata pelajaran within a Pelaksanaan_Ujian — the active set is defined as all questions tagged with (pelaksanaan_ujian_id, mata_pelajaran_id, kelas_id or tingkat). A kelas-level set overrides any tingkat-level set for that kelas.
10. THE CBT_System SHALL provide a downloadable Excel template from the question list page, with the correct column structure and example data, so Guru can fill it offline
11. WHILE an Exam_Session associated with a question set is in Draft state or the question set is not associated with any Exam_Session, THE CBT_System SHALL allow the Guru who created those questions to edit or delete them
12. IF a Guru attempts to edit or delete a question that belongs to a Packaged, Active, or Completed Exam_Session, THEN THE CBT_System SHALL reject the operation and display an error message indicating the session is locked
13. IF a Guru attempts to access questions outside their assigned subject or grade, THEN THE CBT_System SHALL deny the request
14. WHEN a Guru deletes a question that is not associated with any Exam_Session or is associated only with Draft Exam_Sessions, THE CBT_System SHALL remove the question from the Question_Bank

### Requirement 8: Student Exam Participation

**User Story:** As a Siswa, I want to login, view my assigned exam sessions, work on questions, and submit answers, so that I can complete my exams.

#### Acceptance Criteria

1. WHEN a Siswa logs in, THE CBT_System SHALL display only Exam_Sessions assigned to that Siswa that are in Packaged, Active, or Completed state
2. WHEN a Siswa opens an Active Exam_Session, THE CBT_System SHALL present the multiple-choice questions in a mobile-responsive, navigable interface allowing the Siswa to move between questions, and display a countdown timer showing the remaining session duration in minutes and seconds — the UI SHALL be optimized for both desktop and mobile (smartphone) viewports
3. THE CBT_System SHALL allow a Siswa to change answers to any question within the session before final submission
4. WHEN a Siswa submits their answers, THE CBT_System SHALL record the submission timestamp and prevent further modifications to that Exam_Session's answers, including preventing the Siswa from re-opening the exam
5. IF the Exam_Session duration expires before the Siswa submits, THEN THE CBT_System SHALL auto-submit the Siswa's current answers based on the latest Answer_Snapshot
6. IF a Siswa attempts to open an Exam_Session that is not in Active state or that the Siswa has already submitted, THEN THE CBT_System SHALL deny access and display a message indicating the session is not available
7. WHEN a Siswa submits answers with one or more unanswered questions, THE CBT_System SHALL display a confirmation prompt indicating the number of unanswered questions before processing the submission
8. WHEN exam results are released for an Exam_Session, THE CBT_System SHALL display to the Siswa: their total score (correct count / total questions and percentage), and submission timestamp
9. THE Admin_Sekolah SHALL have the ability to configure per-Exam_Session the result detail level: (a) score only, (b) score + per-question correct/incorrect indicator, or (c) score + per-question detail including the correct answer — defaulting to (a) score only
10. THE CBT_System SHALL NOT display correct answers to any Siswa while other Siswa in the same Exam_Session have not yet submitted, regardless of the configured detail level

### Requirement 9: Auto-Grading

**User Story:** As an Admin Sekolah, I want answers to be automatically graded against the answer key, so that results are available immediately after submission without manual correction.

#### Acceptance Criteria

1. WHEN a Siswa submits answers for an Exam_Session (including auto-submission due to timer expiry), THE CBT_System SHALL resolve the Siswa's randomization mapping and compare each answer to the designated correct answer in the Question_Bank using the original answer key
2. THE CBT_System SHALL treat unanswered questions as incorrect and calculate the Siswa's score as the number of correct answers out of total questions, storing both the raw correct count and the total question count
3. THE CBT_System SHALL complete grading for each individual submission within 5 seconds of that submission being received, maintaining this SLA even when processing up to 300 simultaneous submissions per Tenant
4. WHEN the same set of answers is graded against the same answer key, THE CBT_System SHALL produce an identical score (deterministic grading)
5. IF the CBT_System fails to complete grading within 5 seconds, THEN THE CBT_System SHALL queue the submission for retry, flag the grading delay on the Proctor dashboard next to the affected Siswa, and complete grading before the Exam_Session results are released by the Admin_Sekolah

### Requirement 10: Browser-Based Anti-Cheat

**User Story:** As a Proctor, I want the system to deter cheating through browser-level restrictions during exams, so that students are discouraged from accessing unauthorized resources on their personal devices.

#### Acceptance Criteria

1. WHEN a Siswa opens an active Exam_Session, THE CBT_System SHALL request fullscreen mode and display a warning if the Siswa declines or exits fullscreen
2. WHILE a Siswa is in an active Exam_Session, THE CBT_System SHALL monitor browser visibility state (document.visibilitychange) and detect when the Siswa switches tabs, minimizes the browser, or loses window focus
3. WHEN the CBT_System detects a tab switch or focus loss event during an active Exam_Session, THE CBT_System SHALL log the event with the Siswa identity, timestamp, and duration of focus loss, increment the Siswa's violation counter for that session, and update the Proctor dashboard within 10 seconds by displaying a real-time violation flag next to the Siswa's name with the violation type and current violation count
4. IF a Siswa accumulates more than a configurable number of focus loss events (default: 3) during a single Exam_Session, THE CBT_System SHALL display a final warning to the Siswa, flag the Siswa's session as "high-risk cheating suspect" on the Proctor dashboard, and visually distinguish that Siswa in the participant list with a red indicator and their total violation count
5. WHILE a Siswa is in an active Exam_Session, THE CBT_System SHALL disable right-click context menu and text selection on exam content to discourage copying question text
6. WHILE a Siswa is in an active Exam_Session, THE CBT_System SHALL disable keyboard shortcuts for copy (Ctrl+C), paste (Ctrl+V), print (Ctrl+P), and print screen (where detectable)
7. THE CBT_System SHALL enforce single-session login per Siswa account — IF a Siswa attempts to start an Exam_Session while already logged in on another device or browser tab, THEN THE CBT_System SHALL terminate the older session, flag the event on the Proctor dashboard as a multiple-login violation, and allow only the most recent session to proceed
8. WHEN the Admin_Sekolah creates an Exam_Session, THE CBT_System SHALL allow configuration of anti-cheat strictness level (standard: fullscreen + focus detection, or relaxed: no fullscreen requirement) to accommodate different exam types such as practice tests
9. THE CBT_System SHALL support anti-cheat detection on both desktop and mobile browsers — on mobile devices, THE CBT_System SHALL apply visibility change detection and single-session enforcement while gracefully degrading features that are not supported (e.g., fullscreen on iOS Safari, keyboard shortcut blocking)

### Requirement 11: Proctor Real-Time Monitoring

**User Story:** As a Proctor, I want to monitor exam sessions in real time, so that I can detect anomalies, assist students with technical issues, and ensure exam integrity.

#### Acceptance Criteria

1. WHILE an Exam_Session is active, THE CBT_System SHALL display to the Proctor a dashboard showing all participating Siswa with their connection status (connected, disconnected, or reconnecting), current violation count, and cheating flag status, updating within 5 seconds of any status change
2. WHEN a Siswa disconnects from the CBT_System during an active Exam_Session, THE CBT_System SHALL update the Siswa's status to 'disconnected' on the Proctor dashboard within 10 seconds, displaying a distinct disconnection indicator
3. WHEN a Siswa submits answers in less than a configurable percentage (range: 5% to 50%, default: 20%) of the allotted Exam_Session duration, THE CBT_System SHALL flag the submission as a potential early-submission anomaly on the Proctor dashboard within 10 seconds of submission, displaying a distinct early-submission indicator next to the Siswa's name
4. THE CBT_System SHALL allow the Proctor to pause an individual Siswa's exam timer without affecting other participants, for a maximum continuous pause duration of 60 minutes
5. THE CBT_System SHALL allow the Proctor to resume a paused Siswa's exam timer, restoring the Siswa's remaining time as it was at the moment of pause
6. THE CBT_System SHALL allow the Proctor to extend an individual Siswa's exam duration by 1 to 60 minutes per extension action
7. WHEN the Proctor pauses, resumes, or extends time for a Siswa, THE CBT_System SHALL require a reason (1 to 500 characters) and THE Audit_Log SHALL record the Proctor identity, Siswa identity, action taken, timestamp, and the provided reason
8. THE CBT_System SHALL maintain a per-Siswa violation count for each Exam_Session, incrementing on each anti-cheat event (tab switch, focus loss, fullscreen exit, multiple login attempt), and display this count in real time on the Proctor dashboard next to each Siswa's name
9. WHEN a Siswa is flagged as high-risk cheating suspect, THE CBT_System SHALL keep the flag visible in the Proctor dashboard and include it in the post-exam report, regardless of whether the Siswa's subsequent behavior is clean

### Requirement 12: Proctor Post-Exam Reporting

**User Story:** As a Proctor, I want a post-exam report summarizing anomalies and incidents, so that I can document exam integrity for the school's records.

#### Acceptance Criteria

1. WHEN an Exam_Session ends, THE CBT_System SHALL generate a post-exam report listing all anomalies detected during that session
2. THE post-exam report SHALL include the following event types, each with the associated Siswa identity, timestamp, and event description: focus loss/tab switch events, early submissions, disconnections, Proctor interventions (pauses and time extensions), and denied access attempts
3. WHEN an Exam_Session completes, THE CBT_System SHALL make the post-exam report viewable on the Proctor and Admin_Sekolah dashboards within 5 minutes of session completion and shall retain the report for a minimum of 3 years
4. IF an Exam_Session completes with zero anomalies detected, THEN THE CBT_System SHALL still generate the post-exam report indicating that no anomalies were recorded during the session

### Requirement 13: Comprehensive Audit Logging

**User Story:** As a Superadmin, I want complete audit logs of all data access events including read operations, so that question leaks can be investigated by tracing who viewed what and when.

#### Acceptance Criteria

1. THE Audit_Log SHALL record all read access events to Question_Bank data, including the accessor identity, timestamp with millisecond precision, Tenant identifier, and the specific question identifiers viewed
2. THE Audit_Log SHALL record all write operations (create, update, delete) across the CBT_System with actor identity, timestamp with millisecond precision, affected resource identifier, and the before and after values of each modified field
3. THE Audit_Log SHALL be immutable — no user role including Superadmin SHALL have the ability to modify or delete audit log entries
4. THE CBT_System SHALL retain Audit_Log entries for a minimum of 3 years
5. WHEN a Superadmin queries the Audit_Log, THE CBT_System SHALL support filtering by Tenant, user, time range, and resource type, return results within 10 seconds, and paginate results in sets of no more than 500 entries
6. WHEN a Superadmin performs any query against the Audit_Log, THE Audit_Log SHALL record the query event including the Superadmin identity, timestamp, and filter parameters used

### Requirement 14: Role-Based Access Control

**User Story:** As an Admin Sekolah, I want the system to enforce strict role-based access so each user can only perform actions appropriate to their role, so that exam security and operational boundaries are maintained.

#### Acceptance Criteria

1. THE CBT_System SHALL enforce four roles: Superadmin, Admin_Sekolah, Guru, and Siswa, mapped from the LMS user roles (super_admin, admin, guru) plus CBT-specific Siswa accounts
2. THE CBT_System SHALL evaluate role permissions on every API request before processing the request
3. IF a user's request exceeds the permissions defined for their role, THEN THE CBT_System SHALL deny the request, return an authorization error, and record the denied attempt in the Audit_Log including the user identity, requested action, and timestamp
4. THE CBT_System SHALL grant Proctor capabilities (real-time monitoring, pause/extend timers, post-exam reports) to all staff roles (Admin_Sekolah, Guru) without requiring a separate role assignment, since Proctor is a capability not a distinct role
5. THE Admin_Sekolah SHALL have the ability to assign specific staff members as the designated Proctor for an Exam_Session, determining which staff user receives real-time monitoring notifications for that session
6. THE Superadmin SHALL have read-only access across all Tenants as defined in Requirement 2, with account management handled through the LMS
7. THE CBT_System SHALL assign exactly one role per user account at any given time
8. THE CBT_System SHALL map LMS role kepala_sekolah to CBT Admin_Sekolah with identical permissions, granting full school-level CBT management access
9. IF a user authenticates with an LMS role that has no CBT mapping (bendahara, orang_tua), THEN THE CBT_System SHALL deny access with a clear error message indicating that their role does not have CBT access

### Requirement 15: Exam Session Lifecycle

**User Story:** As an Admin Sekolah, I want a clear exam session lifecycle with proper state transitions, so that question edits are prevented once an exam is locked and sessions can be cancelled or reverted when necessary.

#### Acceptance Criteria

1. THE CBT_System SHALL enforce the following Exam_Session states: Draft, Packaged, Active, Completed, and Cancelled
2. WHILE an Exam_Session is in Draft state, THE CBT_System SHALL allow modifications to schedule, duration, target kelas, proctor assignment, and randomization settings
3. WHILE an Exam_Session is in Draft state, THE CBT_System SHALL display the current question count from the resolved Question_Bank_Set (based on the session's mata_pelajaran and target kelas/tingkat) so the Admin_Sekolah can verify readiness before packaging — the question set is resolved dynamically while in Draft and locked only upon packaging
4. WHEN an Admin_Sekolah packages an Exam_Session, THE CBT_System SHALL validate that the resolved Question_Bank_Set has at least one question, at least one active Siswa is assigned (from the target kelas), and a scheduled start time is set before transitioning to Packaged state — upon packaging, the system SHALL snapshot the current Question_Bank_Set, locking those specific questions from further editing
5. WHEN the scheduled start time arrives for a Packaged Exam_Session, THE CBT_System SHALL transition it to Active state within 60 seconds and allow assigned Siswa to begin
6. WHEN all assigned Siswa have submitted (including auto-submissions) or the session duration expires for the last remaining participant (including any individual time extensions granted by the Proctor), THE CBT_System SHALL transition the Exam_Session to Completed state
7. THE Admin_Sekolah SHALL have the ability to cancel a Packaged Exam_Session, transitioning it to Cancelled state
8. WHEN an Admin_Sekolah cancels a Packaged Exam_Session, THE CBT_System SHALL require a cancellation reason between 1 and 500 characters, record it in the Audit_Log, and unlock the associated questions for editing
9. THE Admin_Sekolah SHALL have the ability to unpackage a Packaged Exam_Session (transition back to Draft) ONLY IF the scheduled start time has not yet passed — upon unpackaging, THE CBT_System SHALL unlock associated questions for editing and record the action with a reason in the Audit_Log
10. IF an Admin_Sekolah attempts a state transition not defined in the lifecycle (Draft→Packaged, Packaged→Active, Packaged→Draft, Packaged→Cancelled, Active→Completed), THEN THE CBT_System SHALL deny the operation and display an error message indicating the current state and the reason the transition is not permitted

### Requirement 16: Network Resilience and Answer Persistence

**User Story:** As a Siswa, I want my answers to be saved automatically during the exam, so that I do not lose my work if my connection drops or my machine crashes.

#### Acceptance Criteria

1. WHILE a Siswa is in an active Exam_Session, THE CBT_System SHALL save an Answer_Snapshot to the server every 30 seconds
2. WHEN a Siswa selects or changes an answer, THE CBT_System SHALL save that answer to the server within 5 seconds
3. IF the CBT_System receives no heartbeat from a Siswa's client for 15 consecutive seconds during an active Exam_Session, THEN THE CBT_System SHALL classify the Siswa as disconnected, preserve the latest Answer_Snapshot, and pause the Siswa's exam timer
4. WHEN a disconnected Siswa reconnects within the Exam_Session time window, THE CBT_System SHALL synchronize any answers recorded locally on the client during the offline period with the server-side Answer_Snapshot using a last-write-wins strategy (for each question, the answer with the most recent per-answer timestamp — whether from client or server — is retained), restore the Siswa's question navigation position, and resume the timer from the paused value
5. IF a Siswa fails to reconnect before the Exam_Session time window expires (original start time + total duration including extensions), THEN THE CBT_System SHALL auto-submit the latest Answer_Snapshot as the Siswa's final answers, record the submission as 'auto-submitted due to disconnection timeout' in the Audit_Log, and mark the Siswa's participation as Completed
6. WHEN a Siswa is classified as disconnected, THE CBT_System SHALL update the Siswa's status on the Proctor dashboard within 10 seconds, displaying a disconnection indicator with the timestamp of last heartbeat
7. WHEN a disconnected Siswa reconnects, THE CBT_System SHALL update the Siswa's status on the Proctor dashboard to 'connected' within 10 seconds and clear the disconnection indicator
8. IF a periodic or event-triggered answer save fails, THEN THE CBT_System SHALL retry the save up to 3 times at 5-second intervals, and if all retries fail, THE CBT_System SHALL store the answers locally on the client and display a warning indicator to the Siswa that saving is temporarily unavailable
9. WHEN answer synchronization after reconnection resolves conflicts (client and server had different answers for the same question), THE CBT_System SHALL record all conflict resolution events in the Exam_Session log for audit purposes, including the question identifier, client answer, server answer, and which was retained

### Requirement 17: Question Randomization

**User Story:** As an Admin Sekolah, I want questions and answer options to be randomized per student, so that adjacent students cannot copy each other's answers in a physical classroom.

#### Acceptance Criteria

1. WHEN a Siswa opens an Exam_Session configured with question randomization, THE CBT_System SHALL generate a randomized question order for that Siswa, store it, and present questions in that order for the entire duration of the Exam_Session
2. WHEN a Siswa opens an Exam_Session configured with answer option randomization, THE CBT_System SHALL randomize the order of answer options for each question while preserving the correct answer mapping
3. THE CBT_System SHALL store the randomization mapping per Siswa so that grading correctly maps shuffled answers to the original answer key
4. WHEN the Admin_Sekolah creates an Exam_Session, THE CBT_System SHALL allow configuration of question randomization and answer option randomization independently, with both options disabled by default
5. THE CBT_System SHALL ensure that two Siswa in the same Exam_Session receive different question orderings with a probability exceeding 99% for sessions with 10 or more questions
6. WHEN a Siswa reconnects to an Exam_Session after a disconnection, THE CBT_System SHALL restore the same randomized question and answer option ordering that was originally generated for that Siswa
7. IF an Exam_Session has fewer than 10 questions, THEN THE CBT_System SHALL still apply the configured randomization but is not required to meet the 99% uniqueness probability threshold

### Requirement 18: Shared Database Integration with LMS

**User Story:** As an Admin Sekolah, I want the CBT system to read student, teacher, class, and subject data directly from the shared LMS database, so that data is always up-to-date without manual synchronization.

#### Acceptance Criteria

1. THE CBT_System SHALL connect to the same PostgreSQL database instance as the LMS and read from the LMS tables (user, siswa, kelas, mata_pelajaran, jadwal_pelajaran, tahun_ajaran, tenant) in read-only mode
2. THE CBT_System SHALL derive Guru Question_Bank scope from the LMS jadwal_pelajaran table, such that a Guru's access is determined by their current mata_pelajaran_id and kelas_id (tingkat) assignments in the active tahun_ajaran
3. THE CBT_System SHALL create and manage its own CBT-specific user accounts for Siswa (students) with login credentials, since Siswa do not have user accounts in the LMS
4. THE CBT_System SHALL map LMS user roles to CBT roles as follows: LMS super_admin = CBT Superadmin, LMS admin = CBT Admin_Sekolah, LMS kepala_sekolah = CBT Admin_Sekolah, LMS guru = CBT Guru
5. THE CBT_System SHALL share the same JWT secret as the LMS, such that JWT tokens issued by the LMS are valid for CBT authentication without requiring a separate login for staff users (Superadmin, Admin_Sekolah, Guru)
6. THE CBT_System SHALL NOT write to, modify, or delete any data in LMS-owned tables EXCEPT for the rapor_nilai table (and creating rapor records when needed), to which the CBT_System SHALL write exam scores as a controlled write operation when results are released (as defined in Requirement 6)
7. IF a Guru or Admin_Sekolah user is deactivated in the LMS (is_active = false), THEN THE CBT_System SHALL deny access to that user on the next authentication attempt, while preserving their historical exam data and Question_Bank contributions
8. IF a Siswa record in the LMS has status other than 'aktif', THEN THE CBT_System SHALL prevent that Siswa from accessing any new Exam_Sessions while preserving their historical exam results
9. WHEN a Siswa's kelas_id changes in the LMS, THE CBT_System SHALL retain the Siswa's historical exam results under the original kelas and assign the Siswa to future Exam_Sessions based on their new kelas_id
10. WHEN a Siswa's status becomes non-aktif in the LMS, THE CBT_System SHALL remove the Siswa from all future Exam_Sessions in Draft or Packaged state, but SHALL NOT affect Active sessions the Siswa is currently participating in

### Requirement 19: Admin Sekolah Dashboard

**User Story:** As an Admin Sekolah, I want a dashboard showing the current exam administration status, upcoming and past sessions, and readiness overview, so that I can monitor my school's testing program at a glance.

#### Acceptance Criteria

1. THE CBT_System SHALL display a dashboard to the Admin_Sekolah showing: the active Pelaksanaan_Ujian (if any), count of Exam_Sessions by state (Draft, Packaged, Active, Completed), and upcoming scheduled sessions
2. THE CBT_System SHALL display a readiness overview indicating for each mata pelajaran and kelas: whether an active Question_Bank set exists, the number of questions in the set, and whether an Exam_Session has been created
3. THE Admin_Sekolah SHALL have the ability to view a history of past Pelaksanaan_Ujian with summary statistics (total sessions, total participants, average scores)
4. THE CBT_System SHALL display active Exam_Sessions with real-time participant count (connected/total assigned) accessible from the dashboard

### Requirement 20: Superadmin Tenant Overview

**User Story:** As a Superadmin, I want to view all tenants and navigate into any tenant's CBT data for audit and support purposes, so that I can monitor system-wide readiness and investigate issues.

#### Acceptance Criteria

1. THE CBT_System SHALL display a Superadmin dashboard listing all Tenants with their current status: active Pelaksanaan_Ujian (if any), count of active Exam_Sessions, total registered Siswa, and last activity timestamp
2. THE Superadmin SHALL have the ability to select any Tenant and view that Tenant's CBT data (Pelaksanaan_Ujian, Exam_Sessions, Question_Bank sets, scores, and audit logs) in read-only mode
3. THE CBT_System SHALL display a visual indicator when the Superadmin is viewing a specific Tenant's data, showing the Tenant name prominently to prevent confusion
4. THE Superadmin SHALL have the ability to search and filter the Tenant list by nama, active status, and whether they have an active Pelaksanaan_Ujian
5. THE Superadmin SHALL have access to the Audit_Log query interface as defined in Requirement 13, with cross-Tenant filtering capability

### Requirement 21: Guru Question History

**User Story:** As a Guru, I want to view all questions I have created across all exam administrations and academic years, so that I can reference or review my past work.

#### Acceptance Criteria

1. THE CBT_System SHALL provide a question history view for Guru showing all questions they have created, grouped by Pelaksanaan_Ujian and mata pelajaran
2. THE Guru SHALL be able to filter their question history by tahun ajaran, mata pelajaran, and kelas/tingkat
3. THE CBT_System SHALL display each question's status (active in current Pelaksanaan_Ujian, or inactive/archived from past Pelaksanaan_Ujian)
4. THE CBT_System SHALL allow Guru to view (read-only) questions from inactive/past Pelaksanaan_Ujian but SHALL NOT allow editing them

### Requirement 22: Concurrent Capacity

**User Story:** As an Admin Sekolah, I want the system to handle all my students taking exams simultaneously without degradation, so that exam sessions run smoothly even at peak load.

#### Acceptance Criteria

1. THE CBT_System SHALL support a minimum of 300 concurrent Siswa per Tenant during an active Exam_Session without response time degradation
2. THE CBT_System SHALL serve exam questions to a Siswa within 2 seconds of request under peak load conditions
3. THE CBT_System SHALL process answer submissions within 3 seconds under peak load conditions
4. WHEN multiple Tenants run simultaneous Exam_Sessions, THE CBT_System SHALL maintain the per-Tenant performance targets independently
5. IF the CBT_System detects load approaching capacity limits, THEN THE CBT_System SHALL alert the Superadmin and queue incoming requests rather than rejecting them
6. THE CBT_System SHALL use WebSocket connections for real-time communication between Siswa clients and the Proctor dashboard (heartbeat, answer sync, violation notifications, status updates)
7. THE CBT_System architecture SHALL support horizontal scaling of WebSocket connections via a pub/sub message broker (Redis) to distribute real-time events across multiple server instances

### Requirement 23: CBT Tenant Configuration

**User Story:** As an Admin Sekolah, I want to configure CBT-specific settings for my school (timezone, anti-cheat defaults, thresholds) independently from the LMS tenant settings.

#### Acceptance Criteria

1. THE CBT_System SHALL maintain a CBT_Tenant_Config table with the following configurable fields per Tenant: timezone (default 'Asia/Jakarta'), default anti-cheat strictness level (standard or relaxed), maximum violation count threshold (default 3), early submission threshold percentage (default 20%), and default result detail level (score_only, score_with_indicator, or full_detail)
2. THE Admin_Sekolah SHALL have the ability to view and modify their Tenant's CBT configuration
3. THE CBT_System SHALL automatically create a CBT_Tenant_Config record with default values when a Tenant first accesses the CBT system
4. THE CBT_System SHALL apply the Tenant's configured timezone to all date/time displays and scheduling validations throughout the system

### Requirement 24: Platform Delivery

**User Story:** As a Siswa, I want to access exams from any modern browser on my personal device (desktop or mobile) without installing additional software.

#### Acceptance Criteria

1. THE CBT_System student interface SHALL be a responsive web application accessible via modern browsers (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+) on both desktop and mobile devices
2. THE CBT_System SHALL implement Progressive Web App (PWA) capabilities with a Service Worker for offline answer caching as defined in Requirement 16
3. THE CBT_System admin and Proctor interfaces SHALL be responsive web applications optimized for desktop viewports (minimum 1024px width) with functional access from tablet viewports (768px+)
4. THE CBT_System SHALL NOT require app installation for Siswa — all exam functionality SHALL be accessible through the browser

### Requirement 25: Data Retention and Cleanup

**User Story:** As a Superadmin, I want clear data retention policies so that storage costs are managed while preserving legally required educational records.

#### Acceptance Criteria

1. THE CBT_System SHALL retain student answer data, scores, and exam participation records for a minimum of 5 years from the date of the Exam_Session
2. THE CBT_System SHALL retain Question_Bank data indefinitely for Guru reference (as per Requirement 21) unless explicitly archived by Admin_Sekolah after the associated Pelaksanaan_Ujian has been inactive for more than 2 years
3. THE CBT_System SHALL purge Answer_Snapshot intermediate data (periodic snapshots taken during the exam) 30 days after an Exam_Session completes, retaining only the final submitted answers and the submission metadata
4. THE CBT_System SHALL retain Audit_Log entries for a minimum of 3 years as defined in Requirement 13
5. THE CBT_System SHALL retain post-exam reports for a minimum of 3 years as defined in Requirement 12
6. THE Admin_Sekolah SHALL have the ability to export their Tenant's historical exam data (questions, scores, participation records) in a structured format (JSON or CSV) before any retention-based deletion occurs
