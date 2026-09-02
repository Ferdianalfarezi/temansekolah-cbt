# Implementation Plan

## Bug Condition Exploration Tests (BEFORE Fix)

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Mobile Fullscreen Blocking, Violation Count Reset, Mobile UI Overflow
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: These tests encode the expected behavior - they will validate the fix when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist

  - [x] 1.1 Write iOS/Mobile Fullscreen Blocking exploration test
    - Test that mobile devices (navigator.maxTouchPoints > 0 OR window.innerWidth < 768) see blocking fullscreen overlay
    - Mock `navigator.maxTouchPoints = 2` and `document.fullscreenEnabled = false`
    - Assert on UNFIXED code: `isFullscreen = false` AND overlay IS displayed → **BLOCKS exam access**
    - Expected behavior (after fix): overlay should NOT appear on mobile
    - Document counterexample: "Mobile Safari user sees 'Mode Layar Penuh Diperlukan' overlay that cannot be dismissed"
    - _Requirements: 1.1, 1.2, 2.1, 2.2_

  - [x] 1.2 Write Violation Count Reset exploration test
    - Test that `useAntiCheat` initializes violationCount to 0 regardless of server state
    - Mock exam API response WITHOUT violationCount field
    - Create participant with 5 violations in mock DB state
    - Assert on UNFIXED code: `useState(0)` ignores DB violations → banner shows "0x"
    - Expected behavior (after fix): hook should accept `initialViolationCount` prop and show "5x"
    - Document counterexample: "Student with 5 violations in DB refreshes page → banner shows '0x' instead of '5x'"
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4_

  - [x] 1.3 Write Mobile UI Overflow exploration test
    - Test that viewport < 768px causes horizontal overflow
    - Set viewport to 375px width (iPhone SE)
    - Assert on UNFIXED code: `document.documentElement.scrollWidth > window.innerWidth`
    - Assert: "Kumpulkan" button outside visible viewport bounds
    - Expected behavior (after fix): no horizontal scroll, all buttons visible
    - Document counterexample: "Navigation buttons overflow right edge, requiring horizontal scroll"
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4_

## Preservation Property Tests (BEFORE Fix)

- [x] 2. Write preservation property tests
  - **Property 2: Preservation** - Desktop Fullscreen Enforcement, Desktop Sidebar Layout, Violation Tracking
  - **IMPORTANT**: Follow observation-first methodology - run on UNFIXED code first
  - These tests capture existing correct behavior that must not regress

  - [x] 2.1 Write Desktop Fullscreen Enforcement preservation test
    - **Observe on UNFIXED code**: Desktop Chrome (viewport >= 768px, maxTouchPoints = 0) shows fullscreen overlay when not fullscreen
    - Write property test: FOR ALL device WHERE !isMobile(device) AND antiCheatLevel = "standard"
    - Assert: fullscreen overlay IS displayed when `isFullscreen = false`
    - Assert: fullscreen exit triggers violation recording
    - Verify test PASSES on unfixed code
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 2.2 Write Desktop Sidebar Layout preservation test
    - **Observe on UNFIXED code**: Viewport >= 1024px shows sidebar as fixed right panel
    - Write property test: FOR ALL viewport WHERE viewport.width >= 1024px
    - Assert: navigation sidebar visible as fixed right panel
    - Assert: question grid displays in sidebar
    - Verify test PASSES on unfixed code
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 2.3 Write Violation POST Tracking preservation test
    - **Observe on UNFIXED code**: New violations POST to `/siswa/exam-sessions/:id/violations`
    - Write property test: FOR ALL violation DO violation is POSTed to API
    - Assert: proctor dashboard receives WebSocket `violation_alert` event
    - Assert: relaxed anti-cheat mode still records violations
    - Verify test PASSES on unfixed code
    - _Requirements: 6.1, 6.2, 6.3_

## Implementation

- [x] 3. Modify useAntiCheat hook
  - [x] 3.1 Add `initialViolationCount` parameter to UseAntiCheatOptions interface
    - Add `initialViolationCount?: number` to interface
    - Default to 0 if not provided: `const { initialViolationCount = 0 } = options`
    - Initialize state with prop: `useState(initialViolationCount)`
    - _Bug_Condition: isBugCondition(request) WHERE request.participantHasViolations = true_
    - _Expected_Behavior: hook.violationCount = options.initialViolationCount on mount_
    - _Preservation: Existing violation increment logic unchanged_
    - _Requirements: 5.2, 5.3_

  - [x] 3.2 Add `isMobileDevice()` helper function
    - Create function: `const isMobileDevice = () => navigator.maxTouchPoints > 0 || 'ontouchstart' in window`
    - Export for use in ExamPage.tsx
    - Handle SSR case where `navigator` is undefined
    - _Requirements: 2.1_

  - [x] 3.3 Skip fullscreen request for mobile devices
    - In useEffect that calls `requestFullscreen()`:
    - Add check: `const isMobile = isMobileDevice() || window.innerWidth < 768`
    - Only call requestFullscreen if `level === "standard" && !isMobile`
    - Keep all other monitoring (visibility, focus) unchanged
    - _Bug_Condition: isMobileDevice() = true OR window.innerWidth < 768_
    - _Expected_Behavior: Skip fullscreen API call, allow exam access_
    - _Preservation: Desktop fullscreen enforcement unchanged_
    - _Requirements: 2.1, 3.1, 3.3_

- [x] 4. Update ExamPage.tsx
  - [x] 4.1 Add mobile detection using useMemo
    - Create `isMobile` with useMemo checking `navigator.maxTouchPoints > 0` OR `'ontouchstart' in window` OR `window.innerWidth < 768`
    - Handle SSR case: `if (typeof window === 'undefined') return false`
    - _Requirements: 2.1_

  - [x] 4.2 Modify fullscreen overlay condition
    - Change from `{!isFullscreen && (...)}` to `{!isFullscreen && !isMobile && (...)}`
    - This allows mobile users to bypass fullscreen requirement
    - _Bug_Condition: isMobile = true AND isFullscreen = false_
    - _Expected_Behavior: Overlay NOT rendered on mobile_
    - _Requirements: 2.1_

  - [x] 4.3 Pass initialViolationCount to useAntiCheat
    - Update hook call: `initialViolationCount: examData?.violationCount ?? 0`
    - Ensures client state syncs with server on load/refresh
    - _Bug_Condition: examData.violationCount > 0_
    - _Expected_Behavior: Banner shows correct count from server_
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 4.4 Add mobile landscape orientation banner (non-blocking)
    - After violation warning bar, add info banner for mobile users
    - Style: light blue background, "📱 Rotate device for better experience"
    - Must be informational only, NOT blocking
    - _Requirements: 2.2_

  - [x] 4.5 Update ExamData interface to include violationCount
    - Add `violationCount?: number` to ExamData interface
    - Matches new API response structure
    - _Requirements: 5.1_

  - [x] 4.6 Fix mobile responsive layout - viewport containment
    - Add to main container: `maxWidth: "100vw"`, `overflowX: "hidden"`
    - Prevents horizontal scroll on narrow viewports
    - _Bug_Condition: viewport.width < 768_
    - _Expected_Behavior: No horizontal overflow_
    - _Requirements: 8.1, 8.3_

  - [x] 4.7 Fix mobile responsive layout - footer buttons
    - Add `flexWrap: "wrap"` to footer
    - Reduce padding: `padding: isMobile ? "8px 12px" : "10px 20px"`
    - Abbreviate button text on mobile: "← Sebelumnya" → "←", "Selanjutnya →" → "→"
    - _Bug_Condition: viewport.width < 768_
    - _Expected_Behavior: Buttons wrap and fit within viewport_
    - _Requirements: 8.2, 8.3_

  - [x] 4.8 Fix mobile navigation panel
    - Convert sidebar to collapsible bottom sheet on mobile
    - Add max-height constraint with internal scrolling for question grid
    - Ensure "Akhiri Ujian" button visible within viewport
    - _Bug_Condition: viewport.width < 768_
    - _Expected_Behavior: Navigation accessible without horizontal scroll_
    - _Requirements: 8.1, 8.4_

- [x] 5. Update exam-taking.service.ts
  - [x] 5.1 Add violationCount to startExam response
    - Add `violationCount: 0` to return object (fresh start has 0 violations)
    - _Bug_Condition: Always include for consistency_
    - _Expected_Behavior: API response includes violationCount field_
    - _Requirements: 5.1_

  - [x] 5.2 Add violationCount to getExamState (resume) response
    - Add `violationCount: participant.violationCount ?? 0` to return object
    - Query participant's violation count from database
    - _Bug_Condition: participant has existing violations in DB_
    - _Expected_Behavior: Resume response includes DB violation count_
    - _Requirements: 5.1_

## Verification

- [x] 6. Verify bug condition exploration tests now pass
  - **Property 1: Expected Behavior** - All Bug Conditions Fixed
  - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
  - The tests from task 1 encode the expected behavior
  - When these tests pass, they confirm the bugs are fixed

  - [x] 6.1 Verify Mobile Fullscreen test passes
    - Re-run test from 1.1
    - **EXPECTED OUTCOME**: Test PASSES - mobile devices bypass fullscreen overlay
    - _Requirements: 2.1, 2.2_

  - [x] 6.2 Verify Violation Count Sync test passes
    - Re-run test from 1.2
    - **EXPECTED OUTCOME**: Test PASSES - banner shows correct count from server
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 6.3 Verify Mobile UI Overflow test passes
    - Re-run test from 1.3
    - **EXPECTED OUTCOME**: Test PASSES - no horizontal scroll, all buttons visible
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 7. Verify preservation tests still pass
  - **Property 2: Preservation** - No Regressions
  - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests

  - [x] 7.1 Verify Desktop Fullscreen Enforcement still works
    - Re-run test from 2.1
    - **EXPECTED OUTCOME**: Test PASSES - desktop browsers still enforce fullscreen
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 7.2 Verify Desktop Sidebar Layout preserved
    - Re-run test from 2.2
    - **EXPECTED OUTCOME**: Test PASSES - sidebar layout unchanged on large screens
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 7.3 Verify Violation POST Tracking unchanged
    - Re-run test from 2.3
    - **EXPECTED OUTCOME**: Test PASSES - violations still POST to API, WebSocket works
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 8. Checkpoint - Final Validation
  - Run full test suite: `pnpm test`
  - Verify no regressions in existing tests
  - Manual testing on iOS Safari simulator
  - Manual testing on Chrome mobile emulator (375px viewport)
  - Ask user if any questions arise or additional verification needed
