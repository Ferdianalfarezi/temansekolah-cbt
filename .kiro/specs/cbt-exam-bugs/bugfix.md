# Bugfix Requirements Document

## Introduction

Dokumen ini mencakup 4 bug terkait sistem ujian (exam-taking) di aplikasi siswa CBT Teman Sekolah:

1. **iOS Fullscreen**: Pengguna iOS tidak bisa mengikuti ujian karena fullscreen API tidak didukung
2. **Violation Count Sync**: Jumlah pelanggaran tidak sinkron antara tampilan siswa dan admin  
3. **Violation Count Reset**: Jumlah pelanggaran di siswa ter-reset saat refresh halaman
4. **Mobile UI Terpotong**: Navigation panel dan button "Akhiri Ujian" keluar dari viewport di mobile

Bug 2 dan 3 memiliki root cause yang sama: `useAntiCheat` hook menginisialisasi `violationCount` dari `useState(0)` tanpa mengambil data dari server.

---

## Bug 1: iOS Fullscreen Enforcement

### Current Behavior (Defect)

1.1 WHEN device is iOS Safari AND exam page loads THEN the system displays a blocking fullscreen overlay that cannot be dismissed because iOS does not support the Fullscreen API

1.2 WHEN user on iOS taps "Aktifkan Layar Penuh" button THEN the system fails silently and the overlay remains, preventing exam access

### Expected Behavior (Correct)

2.1 WHEN device is mobile (detected via `navigator.maxTouchPoints > 0` or screen width < 768px) THEN the system SHALL skip fullscreen enforcement and allow exam access without fullscreen

2.2 WHEN device is mobile AND exam starts THEN the system SHALL display a non-blocking banner suggesting landscape orientation for better experience (informational only)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN device is desktop browser with Fullscreen API support THEN the system SHALL CONTINUE TO enforce fullscreen mode for standard anti-cheat level

3.2 WHEN device is desktop AND user exits fullscreen THEN the system SHALL CONTINUE TO detect and record FULLSCREEN_EXIT violation

3.3 WHEN anti-cheat level is "relaxed" THEN the system SHALL CONTINUE TO skip fullscreen requirement on all devices

---

## Bug 2 & 3: Violation Count Not Synced / Reset on Refresh

### Current Behavior (Defect)

4.1 WHEN siswa starts exam via `/siswa/exam-sessions/:id/start` THEN the system returns exam state WITHOUT violationCount field

4.2 WHEN siswa refreshes browser during exam THEN the useAntiCheat hook initializes violationCount to 0, ignoring persisted violations in database

4.3 WHEN siswa has 5 violations recorded in database AND refreshes page THEN the violation banner shows "0x" instead of "5x"

4.4 WHEN admin views proctor dashboard THEN admin sees correct violation count from database, creating inconsistency with siswa view

### Expected Behavior (Correct)

5.1 WHEN siswa starts or resumes exam via `/siswa/exam-sessions/:id/start` THEN the API response SHALL include `violationCount: number` representing total violations recorded for this participant

5.2 WHEN ExamPage loads exam data THEN the system SHALL initialize local violationCount state from `examData.violationCount`

5.3 WHEN new violation is detected locally THEN the system SHALL increment from the server-provided baseline, not from zero

5.4 WHEN siswa refreshes browser during exam THEN the violation banner SHALL display the correct cumulative count matching admin's view

### Unchanged Behavior (Regression Prevention)

6.1 WHEN new violation occurs THEN the system SHALL CONTINUE TO POST violation to `/siswa/exam-sessions/:id/violations` endpoint

6.2 WHEN proctor dashboard receives `violation_alert` WebSocket event THEN admin view SHALL CONTINUE TO update in real-time

6.3 WHEN exam is in "relaxed" anti-cheat mode THEN violation counting behavior SHALL CONTINUE TO function identically

---

## Bug 4: Mobile UI Navigation Overflow

### Current Behavior (Defect)

7.1 WHEN viewport width is mobile size (<768px) THEN the navigation panel (nomor soal grid) overflows beyond viewport boundaries

7.2 WHEN viewport width is mobile size THEN the "Akhiri Ujian" button is positioned outside visible area, requiring horizontal scroll to access

7.3 WHEN siswa uses mobile device AND tries to navigate questions THEN the question number grid is not accessible without scrolling horizontally

### Expected Behavior (Correct)

8.1 WHEN viewport width is mobile size THEN the navigation panel SHALL be displayed as a collapsible bottom sheet or slide-in drawer, fully contained within viewport

8.2 WHEN viewport width is mobile size THEN the "Akhiri Ujian" button SHALL be positioned within the visible viewport area (either in bottom sticky bar or accessible navigation menu)

8.3 WHEN viewport width is mobile size THEN all interactive elements (question navigation, submit button, timer) SHALL be accessible without horizontal scrolling

8.4 WHEN navigation panel is open on mobile THEN it SHALL have max-height constraint with internal scrolling for question grid

### Unchanged Behavior (Regression Prevention)

9.1 WHEN viewport width is desktop size (>=1024px) THEN the navigation sidebar layout SHALL CONTINUE TO display as fixed right panel

9.2 WHEN user selects a question from navigation THEN the system SHALL CONTINUE TO navigate to that question and update current index

9.3 WHEN timer displays on mobile THEN it SHALL CONTINUE TO show correct remaining time in header area

---

## Bug Condition Analysis

### Bug 1 - iOS Fullscreen

```pascal
FUNCTION isBugCondition(device)
  INPUT: device of type DeviceInfo
  OUTPUT: boolean
  
  RETURN device.isMobile = true AND device.fullscreenAPISupported = false
END FUNCTION

// Property: Fix Checking - Mobile Fullscreen Bypass
FOR ALL device WHERE isBugCondition(device) DO
  result ← loadExamPage(device)
  ASSERT result.examAccessible = true AND result.fullscreenOverlayBlocking = false
END FOR

// Property: Preservation - Desktop Fullscreen Enforcement
FOR ALL device WHERE NOT isBugCondition(device) DO
  ASSERT F(device).fullscreenEnforced = F'(device).fullscreenEnforced
END FOR
```

### Bug 2 & 3 - Violation Count Sync

```pascal
FUNCTION isBugCondition(request)
  INPUT: request of type ExamStartRequest
  OUTPUT: boolean
  
  RETURN request.isResuming = true OR request.participantHasViolations = true
END FUNCTION

// Property: Fix Checking - Violation Count in API Response
FOR ALL request WHERE isBugCondition(request) DO
  apiResponse ← startExam'(request)
  dbViolations ← getViolationCount(request.participantId)
  ASSERT apiResponse.violationCount = dbViolations
END FOR

// Property: Fix Checking - UI State Initialization
FOR ALL pageLoad WHERE examData.violationCount > 0 DO
  uiState ← initializeExamPage(examData)
  ASSERT uiState.violationBannerCount = examData.violationCount
END FOR
```

### Bug 4 - Mobile UI Overflow

```pascal
FUNCTION isBugCondition(viewport)
  INPUT: viewport of type ViewportInfo
  OUTPUT: boolean
  
  RETURN viewport.width < 768
END FUNCTION

// Property: Fix Checking - No Horizontal Overflow
FOR ALL viewport WHERE isBugCondition(viewport) DO
  layout ← renderExamPage(viewport)
  ASSERT layout.horizontalScrollRequired = false
  ASSERT layout.submitButtonVisible = true
  ASSERT layout.navigationAccessible = true
END FOR
```
