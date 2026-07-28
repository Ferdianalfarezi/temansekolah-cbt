# CBT Requirements Gap Analysis & Suggestions

## Critical Gaps

### 1. Score Push (Req 6) vs Actual rapor_nilai Schema — Structural Mismatch

**Problem:**
rapor_nilai menyimpan `komponen_nilai` sebagai JSONB array `[{komponen_id, nilai}]` per siswa per mapel. Requirement 6 mendeskripsikan seolah-olah ini simple numeric insert, padahal realitanya:

- Butuh `rapor_id` (record rapor untuk kelas/tahunAjaran/periode harus sudah ada)
- Butuh `guru_id` (siapa yang submit nilai)
- `komponen_nilai` adalah JSONB yang mungkin sudah berisi nilai dari komponen lain yang diinput guru manual
- Upsert constraint di `(rapor_id, siswa_id, mata_pelajaran_id, tenant_id)` — CBT bisa menimpa seluruh JSONB jika tidak hati-hati

**Suggestion:**

- CBT TIDAK boleh melakukan full upsert pada `rapor_nilai`. Sebaliknya, CBT harus:
  1. Cek apakah `rapor` record sudah ada — jika belum, buat dengan status `draft`
  2. Cek apakah `rapor_nilai` record sudah ada untuk siswa+mapel tersebut
  3. Jika sudah ada: **merge** nilai CBT ke dalam JSONB `komponen_nilai` (hanya update/insert komponen_id yang sesuai, jangan overwrite komponen lain)
  4. Jika belum ada: insert baru dengan `guru_id` = guru yang di-assign di jadwal_pelajaran untuk mapel+kelas tersebut (atau Admin_Sekolah sebagai fallback)
- Tambahkan acceptance criteria:
  - "THE CBT_System SHALL merge exam scores into the existing komponen_nilai JSONB array without modifying values for other komponen_penilaian entries"
  - "THE CBT_System SHALL use the Guru assigned to the mata_pelajaran+kelas in jadwal_pelajaran as the guru_id for score entries, falling back to the Admin_Sekolah if no guru assignment exists"
  - "IF no rapor record exists for the target kelas/tahun_ajaran/periode, THEN THE CBT_System SHALL create a draft rapor record before inserting scores"

---

### 2. Tenant Tidak Punya Field Timezone

**Problem:**
Requirement 5 AC8 menyatakan "THE CBT_System SHALL use the Tenant's configured timezone" tapi tabel `tenant` di LMS tidak punya kolom timezone.

**Suggestion:**
Dua opsi:

- **Opsi A (Recommended):** CBT memiliki tabel konfigurasi sendiri `cbt_tenant_config` yang menyimpan timezone dan setting CBT-specific lainnya (anti-cheat defaults, max concurrent sessions, dll)
- **Opsi B:** Minta tim LMS menambahkan kolom `timezone` di tabel `tenant` (ini butuh koordinasi dan migrasi LMS)

Saya recommend Opsi A karena CBT punya banyak tenant-level config yang spesifik (anti-cheat strictness default, violation threshold, early submission threshold, dll) — lebih clean punya tabel sendiri daripada menambah kolom di LMS.

```
cbt_tenant_config:
  - tenant_id (FK → tenant.id, unique)
  - timezone (varchar, default 'Asia/Jakarta')
  - default_anti_cheat_level (enum: 'standard', 'relaxed')
  - max_violation_count (integer, default 3)
  - early_submission_threshold_pct (integer, default 20)
  - created_at, updated_at
```

---

### 3. Siswa NISN Nullable — Sync Lifecycle Tidak Jelas

**Problem:**
NISN di tabel `siswa` adalah nullable. Requirement 3 AC7 bilang "only create accounts for Siswa with non-null NISN." Tapi tidak ada mekanisme untuk:

- Siswa yang awalnya belum punya NISN lalu di-assign kemudian
- Kapan sync dilakukan (real-time trigger? cron? manual?)
- Apa yang terjadi jika NISN berubah di LMS

**Suggestion:**
Tambahkan requirement atau AC baru:

- "THE CBT_System SHALL run a Siswa account synchronization check at minimum once every 24 hours, creating new CBT accounts for Siswa who have since been assigned a non-null NISN and status 'aktif'"
- "THE CBT_System SHALL provide an Admin_Sekolah action to manually trigger Siswa account synchronization for their Tenant"
- "IF a Siswa's NISN is modified in the LMS, THE CBT_System SHALL update the Siswa's login identifier on the next sync cycle and notify the Admin_Sekolah"
- "THE CBT_System SHALL NOT delete or deactivate a Siswa CBT account if their NISN becomes null in the LMS; instead it SHALL flag the account for Admin review"

---

### 4. Exam_Session → Multiple Kelas Logic Ambigu

**Problem:**

- Req 5 AC2 bilang Admin memilih "target kelas" (seakan singular)
- Req 5 AC4 bicara tentang resolution kelas-specific vs tingkat-level Question_Bank dalam satu Exam_Session
- Ini kontradiktif — apakah satu session bisa span multiple kelas?

**Suggestion:**
Pilih salah satu model dan konsisten:

- **Model A (Recommended): Satu Exam_Session = Satu Kelas**
  - Lebih simple, clear separation
  - Admin bisa bulk-create sessions untuk multiple kelas sekaligus (batch action)
  - Question_Bank resolution straightforward: kelas-specific override > tingkat-level default
  - Proctor dashboard per-session, tidak perlu handle mixed question sets

- **Model B: Satu Exam_Session = Multiple Kelas (current ambiguity)**
  - Lebih complex, mixed question sets dalam satu session
  - Proctor harus bisa membedakan siswa per kelas
  - Scoring dan reporting jadi lebih rumit

Jika pilih Model A, revisi AC menjadi:

- AC2: "target kelas (satu kelas per Exam_Session)" dan tambahkan "THE Admin_Sekolah SHALL have the ability to batch-create Exam_Sessions for multiple kelas with identical configuration (same mapel, schedule, duration, proctor)"
- Hapus/simplify AC4: "THE CBT_System SHALL resolve the Question_Bank for the Exam_Session's kelas as follows: if a kelas-specific set exists, use it; otherwise, use the tingkat-level set"

---

### 5. Siswa Account Lifecycle Events Tidak Lengkap

**Problem:**
Tidak ada handling untuk:

- Siswa pindah kelas mid-year (kelas_id berubah) — exam history ikut?
- Siswa jadi non-aktif saat sedang assigned ke Exam_Session yang belum berlangsung
- Siswa pindah sekolah (tenant berubah)

**Suggestion:**
Tambahkan ACs:

- "WHEN a Siswa's kelas_id changes in the LMS, THE CBT_System SHALL retain the Siswa's historical exam results under the original kelas and assign the Siswa to future Exam_Sessions based on their new kelas_id"
- "WHEN a Siswa's status becomes non-aktif in the LMS, THE CBT_System SHALL remove the Siswa from all future Exam_Sessions in Draft or Packaged state, but SHALL NOT affect Active sessions the Siswa is currently participating in"
- "THE CBT_System SHALL deactivate a Siswa's CBT account when their status becomes non-aktif, preserving all historical data for audit purposes"

---

### 6. Requirement 16 AC5 — Incomplete (Document Cut Off)

**Problem:**
Teks terpotong di "IF a Siswa fails to reconnect..." tanpa penyelesaian.

**Suggestion:**
Lengkapi dengan:

- "IF a Siswa fails to reconnect before the Exam_Session time window expires (original start time + duration), THEN THE CBT_System SHALL auto-submit the Siswa's latest Answer_Snapshot as their final submission, record the submission as 'auto-submitted due to disconnection' in the Audit_Log, and mark the Siswa's session as Completed"

---

## Logic Gaps

### 7. Pelaksanaan Ujian Deactivation vs Active Sessions

**Problem:**
Req 4 AC7 bilang deactivation cancels Draft/Packaged sessions. Tapi tidak ada guard terhadap deactivation saat ada session yang Active (siswa sedang ujian).

**Suggestion:**
Tambahkan AC:

- "THE CBT_System SHALL NOT allow deactivation of a Pelaksanaan_Ujian while any associated Exam_Session is in Active state. The Admin_Sekolah must wait for all Active sessions to complete before deactivating."

---

### 8. Tidak Ada Packaged → Draft Transition (Unpackage)

**Problem:**
Jika Admin salah package, satu-satunya opsi adalah cancel dan buat ulang. Ini UX yang buruk untuk kasus common mistake.

**Suggestion:**
Tambahkan state transition Packaged → Draft ("Unpackage") dengan constraint:

- "THE Admin_Sekolah SHALL have the ability to unpackage a Packaged Exam_Session (transition back to Draft) ONLY IF the scheduled start time has not yet passed"
- "WHEN an Exam_Session is unpackaged, THE CBT_System SHALL unlock associated questions for editing and record the action in the Audit_Log with a reason"
- Update Req 15 AC8 valid transitions: tambahkan Packaged→Draft

---

### 9. Question Bank "Set" Definition Tidak Jelas

**Problem:**
Apakah "set" itu semua questions untuk (pelaksanaan_ujian + mapel + tingkat/kelas)? Atau ada entity eksplisit yang grouping questions? Bisa Guru buat questions untuk mapel+tingkat yang sama tapi beda exam session?

**Suggestion:**
Perjelas model:

- **Recommended:** Question_Bank set = all questions dengan filter (pelaksanaan_ujian_id, mata_pelajaran_id, tingkat/kelas_id). Tidak ada entitas "bank" terpisah. Questions di-tag langsung.
- Tambahkan definisi di Glossary: "Question_Bank Set: The collection of all questions within a specific Pelaksanaan_Ujian, for a specific mata_pelajaran, scoped to either a tingkat (grade level) or a specific kelas. A Guru creates questions into this logical set."
- Tambahkan AC: "WHEN an Admin_Sekolah creates an Exam_Session, THE CBT_System SHALL determine the question set by matching (pelaksanaan_ujian_id, mata_pelajaran_id, kelas's tingkat or kelas_id). The Admin_Sekolah may optionally specify the number of questions to include (random subset from the set) or use all questions."

---

### 10. Siswa View Setelah Results Released — Tidak Ada Requirement

**Problem:**
Tidak ada requirement yang describe apa yang Siswa lihat setelah Admin release results. Score saja? Per-question breakdown? Jawaban benar?

**Suggestion:**
Tambahkan requirement baru (Req 22 atau tambah AC di Req 8):

- "WHEN exam results are released for an Exam_Session, THE CBT_System SHALL display to the Siswa: their total score (correct/total and percentage), and submission timestamp"
- "THE Admin_Sekolah SHALL have the ability to configure per-Exam_Session whether to show: (a) score only, (b) score + per-question correct/incorrect indicator, or (c) score + per-question detail including the correct answer"
- "THE CBT_System SHALL NOT display correct answers to Siswa while other Siswa in the same Exam_Session have not yet submitted (to prevent answer leakage in staggered sessions)"

---

### 11. Kepala Sekolah & Bendahara Role Mapping Tidak Ada

**Problem:**
LMS punya roles `kepala_sekolah` dan `bendahara`. CBT requirements hanya map 3 roles (super_admin, admin, guru). Staff dengan role lain yang login via shared JWT akan error.

**Suggestion:**
Tambahkan AC di Requirement 14:

- "IF a user authenticates with an LMS role that has no CBT mapping (kepala_sekolah, bendahara, orang_tua), THEN THE CBT_System SHALL deny access with a clear error message indicating that their role does not have CBT access"
- Atau jika Kepala Sekolah seharusnya punya akses: "THE CBT_System SHALL map LMS role kepala_sekolah to CBT Admin_Sekolah with identical permissions"

Recommend: map `kepala_sekolah` → `Admin_Sekolah` (mereka perlu melihat exam readiness), deny `bendahara` dan `orang_tua`.

---

### 12. Platform Delivery: Web-Only vs Mobile App

**Problem:**
Introduction bilang "student personal devices" dan anti-cheat mentions mobile. Tapi tidak ada explicit requirement tentang delivery platform. Apakah ini:

- Web app responsive (browser-based)?
- PWA?
- Separate mobile app (Flutter, sesuai existing LMS mobile)?

Ini krusial karena anti-cheat (Req 10) sangat bergantung pada platform:

- Fullscreen API tidak reliable di iOS Safari
- Visibility change detection beda behavior di mobile browsers
- Copy/paste blocking limitasi beda di mobile

**Suggestion:**
Tambahkan requirement eksplisit:

- "THE CBT_System student interface SHALL be a responsive web application accessible via modern browsers (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+) on both desktop and mobile devices"
- "THE CBT_System SHALL be designed as a Progressive Web App (PWA) with offline answer caching capability as defined in Requirement 16"
- Atau jika akan pakai Flutter: definisikan scope mobile app vs web app dengan jelas

Recommend: Web app (PWA) untuk siswa, karena:

- Tidak perlu install, reduce friction
- Deployment lebih cepat
- Anti-cheat browser-based sudah defined di requirements
- Offline caching bisa via Service Worker

---

### 13. Proctor Assignment — Tidak Ada Concurrency Constraint

**Problem:**
Tidak ada yang mencegah assign Proctor yang sama ke overlapping sessions. Seorang proctor monitoring 5 session simultaneous defeats the purpose.

**Suggestion:**
Tambahkan AC di Requirement 5:

- "THE CBT_System SHALL warn the Admin_Sekolah if the selected Proctor is already assigned to another Exam_Session with overlapping time window, but SHALL NOT prevent the assignment"
- Atau strict: "THE CBT_System SHALL NOT allow assigning a Proctor to an Exam_Session if that Proctor is already assigned to another session with overlapping schedule (start_time to start_time + duration)"

Recommend: Warning only (not blocking) — ada cases legitimate di mana satu guru proctor multiple sessions (sekolah kecil dengan staff terbatas).

---

### 14. Data Retention Policy Tidak Lengkap

**Problem:**
Hanya audit logs yang punya retention policy (3 tahun). Bagaimana dengan:

- Student answer data
- Question banks dari Pelaksanaan_Ujian lama
- Answer snapshots
- Anti-cheat violation logs

**Suggestion:**
Tambahkan requirement non-functional:

- "THE CBT_System SHALL retain student answer data, scores, and exam participation records for a minimum of 5 years (sesuai aturan arsip pendidikan)"
- "THE CBT_System SHALL retain Question_Bank data indefinitely for Guru reference (Req 20) unless explicitly deleted by Admin_Sekolah after the associated Pelaksanaan_Ujian has been inactive for more than 2 years"
- "THE CBT_System SHALL purge Answer_Snapshot intermediate data 30 days after an Exam_Session completes, retaining only the final submitted answers"

---

### 15. Answer Snapshot Conflict Resolution Strategy

**Problem:**
Req 16 AC4 bilang "synchronize answers recorded locally during offline period with server-side Answer_Snapshot" tapi tidak define conflict resolution.

**Suggestion:**
Tambahkan AC:

- "WHEN synchronizing offline answers with the server, THE CBT_System SHALL apply a last-write-wins strategy based on per-answer timestamps: for each question, the answer with the most recent timestamp (whether from client or server) SHALL be retained as the authoritative answer"
- "THE CBT_System SHALL record all conflict resolution events (where client and server had different answers for the same question) in the Exam_Session log for audit purposes"

---

## Minor Issues

### 16. Superadmin Notification (Req 2 AC5) — Delivery Channel Unclear

**Problem:** "In-app notification within 60 seconds" — jika Admin_Sekolah tidak sedang online, notifikasi terlewat?

**Suggestion:** Specify sebagai persistent notification (tersimpan, bisa dilihat saat login). Real-time delivery kalau online, queued kalau offline. Notification tetap ada sampai di-acknowledge.

---

### 17. Grading SLA (Req 9 AC3) Under Peak Load

**Problem:** "Within 5 seconds" — saat 300 siswa auto-submit bersamaan (timer habis), apakah ini 5 detik per siswa atau total?

**Suggestion:** Clarify: "THE CBT_System SHALL complete grading for each individual submission within 5 seconds of that submission being received, maintaining this SLA even when processing up to 300 simultaneous submissions per Tenant"

---

### 18. No WebSocket/Real-Time Architecture Mentioned

**Problem:** Proctor real-time monitoring (Req 11) needs WebSocket or SSE. Concurrent capacity (Req 21) doesn't mention connection scaling.

**Suggestion:** Tambahkan technical constraint:

- "THE CBT_System SHALL use WebSocket connections for real-time communication between Siswa clients and the Proctor dashboard"
- "THE CBT_System architecture SHALL support horizontal scaling of WebSocket connections via sticky sessions or a pub/sub message broker (e.g., Redis)"

---

### 19. Question Image/Media Support Tidak Ada

**Problem:** Questions hanya text (1-2000 chars). Banyak ujian Indonesia butuh gambar (diagram, peta, grafik).

**Suggestion:** Jika ini V1 limitation, document explicitly:

- "V1 LIMITATION: THE CBT_System SHALL support text-only questions and answer options. Image/media support is planned for a future version."
- Atau tambahkan support: "THE CBT_System SHALL support optional image attachments (max 2MB, formats: PNG, JPG, WebP) for question text and each answer option"

---

## Summary Prioritas

| #     | Gap                          | Severity    | Effort to Fix                           |
| ----- | ---------------------------- | ----------- | --------------------------------------- |
| 1     | rapor_nilai schema mismatch  | 🔴 Critical | Medium — revisi AC + design merge logic |
| 4     | Multi-kelas ambiguity        | 🔴 Critical | Low — pilih model dan rewrite ACs       |
| 6     | Incomplete AC (doc cut off)  | 🔴 Critical | Low — lengkapi teks                     |
| 2     | Tenant timezone              | 🟡 High     | Low — tambah cbt_tenant_config          |
| 7     | Deactivation guard           | 🟡 High     | Low — tambah 1 AC                       |
| 11    | Missing role mapping         | 🟡 High     | Low — tambah 1-2 ACs                    |
| 3     | NISN sync lifecycle          | 🟡 High     | Medium — tambah sync requirement        |
| 5     | Siswa lifecycle events       | 🟡 High     | Medium — tambah 3 ACs                   |
| 9     | Question bank set definition | 🟡 High     | Medium — perjelas glossary + ACs        |
| 10    | Siswa result view            | 🟠 Medium   | Low — tambah requirement                |
| 8     | Unpackage capability         | 🟠 Medium   | Low — tambah state transition           |
| 12    | Platform delivery clarity    | 🟠 Medium   | Low — tambah 1 requirement              |
| 15    | Conflict resolution          | 🟠 Medium   | Low — tambah 1 AC                       |
| 13    | Proctor concurrency          | 🟢 Low      | Low — tambah warning                    |
| 14    | Data retention               | 🟢 Low      | Low — tambah non-functional req         |
| 16-19 | Minor clarifications         | 🟢 Low      | Low each                                |
