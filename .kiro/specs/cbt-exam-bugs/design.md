# CBT Exam Bugs - Bugfix Design

## Overview

This design addresses 4 related bugs in the CBT siswa exam-taking interface:

1. **iOS Fullscreen** - Blocking overlay prevents iOS users from taking exams
2. **Violation Count Sync** - Server violation count not synced to client on exam start/resume
3. **Violation Count Reset** - Local state resets to 0 on page refresh
4. **Mobile UI Overflow** - Navigation elements overflow viewport on mobile devices

The fix strategy involves: (1) detecting mobile devices to skip fullscreen enforcement, (2) adding `violationCount` to API response and initializing client state from it, and (3) restructuring mobile layout with responsive CSS and bottom sheet navigation.

## Glossary

- **Bug_Condition (C)**: Condition that triggers the bug - mobile device OR missing violation sync OR narrow viewport
- **Property (P)**: Desired behavior - exam accessible on mobile, violation count synced, no horizontal scroll
- **Preservation**: Desktop fullscreen enforcement, real-time violation tracking, sidebar navigation on large screens
- **isMobileDevice()**: Detection function using `navigator.maxTouchPoints > 0` or `'ontouchstart' in window`
- **useAntiCheat**: React hook in `apps/siswa/src/hooks/useAntiCheat.ts` managing anti-cheat behavior
- **ExamPage**: Main exam component in `apps/siswa/src/pages/ExamPage.tsx`
- **ExamTakingService**: API service in `apps/api/src/modules/exam-taking/exam-taking.service.ts`

## Bug Details

### Bug 1: iOS Fullscreen Enforcement

The bug manifests when a user on iOS/mobile visits the exam page. The `ExamPage.tsx` renders a **blocking fullscreen overlay** that cannot be dismissed because:
1. iOS Safari does not support the Fullscreen API (`document.fullscreenEnabled = false`)
2. The overlay checks `!isFullscreen` which will always be `true` on iOS
3. The "Aktifkan Layar Penuh" button calls `enterFullscreen()` which silently fails

**Formal Specification:**
```
FUNCTION isBugCondition_Fullscreen(device)
  INPUT: device of type DeviceInfo
  OUTPUT: boolean
  
  RETURN device.hasTouch = true OR device.screenWidth < 768
END FUNCTION
```

### Bug 2 & 3: Violation Count Sync/Reset

The bug manifests when a student refreshes the browser during an exam or when `useAntiCheat` initializes. The hook initializes `violationCount` to `0` regardless of database state:

```typescript
// Current defective code (useAntiCheat.ts line 28)
const [violationCount, setViolationCount] = useState(0);
```

The API's `startExam` and `getExamState` methods do not include `violationCount` in responses.

**Formal Specification:**
```
FUNCTION isBugCondition_ViolationSync(request)
  INPUT: request of type ExamStartRequest  
  OUTPUT: boolean
  
  RETURN request.participantHasViolationsInDB = true
END FUNCTION
```

### Bug 4: Mobile UI Navigation Overflow

From screenshot analysis, the following elements are cut off on mobile:
- Text "SOAL 1 DARI 12" shows as "DARI 12" (left portion hidden)
- Question text truncated at start
- Bottom nav buttons (Sebelumnya, Selanjutnya, Kumpulkan) overflow right edge
- Navigation toggle "1/12" partially visible

Root cause: The `ExamPage.tsx` uses fixed pixel widths and `padding: "14px 24px"` without responsive constraints. The footer uses `display: flex` with `justifyContent: space-between` but buttons don't wrap.

**Formal Specification:**
```
FUNCTION isBugCondition_MobileOverflow(viewport)
  INPUT: viewport of type ViewportInfo
  OUTPUT: boolean
  
  RETURN viewport.width < 768
END FUNCTION
```

### Examples

**Bug 1 - iOS Fullscreen:**
- User on iPhone Safari visits `/exam/abc123` → sees "Mode Layar Penuh Diperlukan" overlay → taps button → nothing happens → **BLOCKED**
- Expected: Should see exam content directly without fullscreen requirement

**Bug 2/3 - Violation Count:**
- Student has 5 violations in DB → refreshes page → banner shows "0x" → **INCORRECT**
- Admin sees "5 violations" in proctor dashboard → **INCONSISTENT**
- Expected: Both should show "5x"

**Bug 4 - Mobile Overflow:**
- Student on 375px iPhone → "SOAL" text cut off → navigation buttons require horizontal scroll → **UNUSABLE**
- Expected: All elements visible, responsive layout, no horizontal scroll

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
1. Desktop browsers with Fullscreen API support SHALL continue to enforce fullscreen mode for "standard" anti-cheat level
2. Fullscreen exit violations SHALL continue to be detected and recorded on desktop
3. "Relaxed" anti-cheat level SHALL continue to skip fullscreen requirement on all devices
4. Real-time violation POSTing to `/siswa/exam-sessions/:id/violations` SHALL continue unchanged
5. Proctor dashboard WebSocket updates SHALL continue to work
6. Desktop sidebar navigation layout (≥1024px) SHALL remain as fixed right panel
7. Question navigation, answer selection, and timer SHALL continue to function identically

**Scope:**
All inputs that do NOT involve mobile device detection, violation count initialization, or viewport width < 768px should be completely unaffected by this fix.

## Hypothesized Root Cause

### Bug 1 - iOS Fullscreen
1. **Missing Mobile Detection**: The fullscreen overlay renders unconditionally when `!isFullscreen` is true
2. **No Graceful Degradation**: Code logs a warning but doesn't suppress the blocking overlay
3. **Screen Width Not Considered**: Only checks `isFullscreen` state, not device capability

### Bug 2 & 3 - Violation Count
1. **Missing API Response Field**: `startExam` and `getExamState` methods don't return `violationCount`
2. **Hook Initializes to Zero**: `useState(0)` doesn't accept initial value from props/context
3. **No Initial Value Prop**: `useAntiCheat` doesn't accept `initialViolationCount` parameter

### Bug 4 - Mobile Overflow
1. **Fixed Padding**: `padding: "14px 24px"` on footer doesn't scale for narrow screens
2. **No Flex Wrap**: Footer buttons use `gap: "8px"` but don't wrap on overflow
3. **Missing max-width/overflow**: Main content area has no horizontal containment
4. **Button Min-Width**: "Sebelumnya" and "Selanjutnya" buttons have minimum padding that exceeds viewport

## Correctness Properties

Property 1: Bug Condition - Mobile Device Fullscreen Bypass

_For any_ device where `isMobileDevice()` returns true OR `window.innerWidth < 768`, the exam page SHALL NOT display a blocking fullscreen overlay and SHALL allow immediate exam access.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - Violation Count Sync from Server

_For any_ exam start/resume API response, the response SHALL include `violationCount: number` field representing the participant's total violations in the database.

**Validates: Requirements 5.1**

Property 3: Bug Condition - Violation Count UI Initialization

_For any_ ExamPage load where `examData.violationCount > 0`, the useAntiCheat hook SHALL initialize its local state from the provided value, and the violation banner SHALL display the correct count.

**Validates: Requirements 5.2, 5.3, 5.4**

Property 4: Bug Condition - Mobile No Horizontal Overflow

_For any_ viewport width < 768px, all exam page elements (header, question, footer, navigation) SHALL be visible without horizontal scrolling, and the "Kumpulkan" button SHALL be accessible.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

Property 5: Preservation - Desktop Fullscreen Enforcement

_For any_ device where `!isMobileDevice()` AND `window.innerWidth >= 768` AND anti-cheat level is "standard", the fullscreen overlay SHALL continue to appear when not in fullscreen mode.

**Validates: Requirements 3.1, 3.2, 3.3**

Property 6: Preservation - Desktop Sidebar Layout

_For any_ viewport width ≥ 1024px, the navigation sidebar SHALL remain as a fixed right panel with the existing grid layout.

**Validates: Requirements 9.1, 9.2, 9.3**

## Fix Implementation

### Changes Required

#### File 1: `apps/siswa/src/hooks/useAntiCheat.ts`

**Change 1.1: Add initialViolationCount parameter**
```typescript
export interface UseAntiCheatOptions {
  enabled: boolean;
  level: "standard" | "relaxed";
  initialViolationCount?: number;  // NEW
  onViolation: (type: ViolationType, durationMs?: number) => void;
}

export function useAntiCheat(options: UseAntiCheatOptions) {
  const { enabled, level, initialViolationCount = 0, onViolation } = options;
  
  const [violationCount, setViolationCount] = useState(initialViolationCount);
  // ...rest unchanged
}
```

**Change 1.2: Skip fullscreen request for mobile devices**

In the `useEffect` that calls `requestFullscreen()`:
```typescript
useEffect(() => {
  if (!enabled) return;
  
  // Skip fullscreen for mobile devices (iOS Safari doesn't support it)
  const isMobile = isMobileDevice() || window.innerWidth < 768;
  if (level === "standard" && !isMobile) {
    requestFullscreen();
  }
  // ...rest of visibility/focus monitoring unchanged
}, [enabled, level, ...]);
```

---

#### File 2: `apps/siswa/src/pages/ExamPage.tsx`

**Change 2.1: Add isMobile detection and skip fullscreen overlay**

Add at component top:
```typescript
// Detect mobile device for fullscreen bypass
const isMobile = useMemo(() => {
  if (typeof window === 'undefined') return false;
  return navigator.maxTouchPoints > 0 || 'ontouchstart' in window || window.innerWidth < 768;
}, []);
```

**Change 2.2: Modify fullscreen overlay condition**

Change the overlay render from:
```tsx
{!isFullscreen && (
  <div style={{ position: "fixed", ... }}>...</div>
)}
```

To:
```tsx
{!isFullscreen && !isMobile && (
  <div style={{ position: "fixed", ... }}>...</div>
)}
```

**Change 2.3: Pass initial violation count to useAntiCheat**
```typescript
const { violationCount } = useAntiCheat({
  enabled: !!examData,
  level: "standard",
  initialViolationCount: examData?.violationCount ?? 0,  // NEW
  onViolation: (type, durationMs) => { ... },
});
```

**Change 2.4: Add mobile landscape orientation banner (non-blocking)**

After the violation warning bar, add:
```tsx
{isMobile && (
  <div style={{
    background: "#eff6ff",
    borderBottom: "1px solid #bfdbfe",
    padding: "8px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontSize: "12px",
    color: "#1d4ed8",
  }}>
    📱 Rotate device for better experience
  </div>
)}
```

**Change 2.5: Fix mobile responsive layout**

Update footer styles with responsive approach:
```tsx
<footer style={{
  display: "flex",
  flexWrap: "wrap",  // Allow wrapping
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  padding: "12px 16px",  // Reduced padding for mobile
  background: "white",
  borderTop: "2px solid #e7e5e4",
}}>
```

Update button styles to use percentage/max-width:
```tsx
// "Sebelumnya" button - abbreviated on mobile
<button style={{
  ...existingStyles,
  padding: isMobile ? "8px 12px" : "10px 20px",
  fontSize: isMobile ? "13px" : "14px",
}}>
  {isMobile ? "←" : "← Sebelumnya"}
</button>

// "Selanjutnya" button - abbreviated on mobile  
<button style={{
  ...existingStyles,
  padding: isMobile ? "8px 12px" : "10px 20px",
  fontSize: isMobile ? "13px" : "14px",
}}>
  {isMobile ? "→" : "Selanjutnya →"}
</button>
```

**Change 2.6: Add viewport containment to main container**
```tsx
<div style={{
  display: "flex",
  minHeight: "100vh",
  flexDirection: "column",
  background: "#fafaf9",
  maxWidth: "100vw",      // NEW: Prevent horizontal overflow
  overflowX: "hidden",    // NEW: Hide any accidental overflow
}}>
```

---

#### File 3: `apps/api/src/modules/exam-taking/exam-taking.service.ts`

**Change 3.1: Add violationCount to startExam response**

In `startExam()` method, add to return object:
```typescript
return {
  participantId: participant.id,
  sessionId,
  durationMinutes: session.durationMinutes,
  remainingSeconds: session.durationMinutes * 60,
  totalQuestions: orderedQuestions.length,
  questions: orderedQuestions,
  violationCount: 0,  // NEW: Fresh start has 0 violations
};
```

**Change 3.2: Add violationCount to getExamState (resume) response**

In `getExamState()` method, add to return object:
```typescript
return {
  participantId: participant.id,
  sessionId: session.id,
  durationMinutes: session.durationMinutes,
  remainingSeconds: this.calculateRemainingSeconds(participant, session),
  totalQuestions: orderedQuestions.length,
  questions: orderedQuestions,
  savedAnswers,
  violationCount: participant.violationCount ?? 0,  // NEW: From DB
};
```

---

#### File 4: `apps/siswa/src/pages/ExamPage.tsx` - Interface Update

**Change 4.1: Update ExamData interface**
```typescript
interface ExamData {
  sessionId: string;
  participantId: string;
  durationMinutes: number;
  remainingSeconds: number;
  totalQuestions: number;
  questions: Question[];
  savedAnswers?: Record<string, string>;
  namaUjian?: string;
  violationCount?: number;  // NEW
}
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing fixes. Confirm or refute the root cause analysis.

**Test Plan**: Create test scenarios that trigger each bug condition on the unfixed code.

**Test Cases**:
1. **iOS Fullscreen Test**: Load ExamPage in iOS Safari simulator → assert blocking overlay visible → assert `enterFullscreen()` fails silently (will fail = overlay blocks forever on unfixed code)
2. **Violation Sync Test**: Mock API response without `violationCount` → load ExamPage → assert banner shows 0 even if DB has 5 (will show incorrect count on unfixed code)
3. **Mobile Overflow Test**: Set viewport to 375px → load ExamPage → assert horizontal scroll exists → assert "Kumpulkan" button outside viewport (will fail on unfixed code)

**Expected Counterexamples**:
- iOS: Fullscreen overlay appears and cannot be dismissed
- Violation: Banner shows "0x" when DB has 5 violations
- Mobile: `document.documentElement.scrollWidth > window.innerWidth`

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
// Bug 1: iOS Fullscreen
FOR ALL device WHERE isMobileDevice(device) DO
  page := loadExamPage(device)
  ASSERT page.fullscreenOverlay.visible = false
  ASSERT page.examContent.accessible = true
END FOR

// Bug 2/3: Violation Count
FOR ALL participant WHERE participant.violationCount > 0 DO
  response := callStartExam(participant)
  ASSERT response.violationCount = participant.violationCount
  page := loadExamPage(response)
  ASSERT page.violationBanner.count = response.violationCount
END FOR

// Bug 4: Mobile Overflow
FOR ALL viewport WHERE viewport.width < 768 DO
  page := renderExamPage(viewport)
  ASSERT page.horizontalScrollRequired = false
  ASSERT page.submitButton.isVisible = true
  ASSERT page.allNavButtons.areAccessible = true
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
// Desktop fullscreen enforcement preserved
FOR ALL device WHERE NOT isMobileDevice(device) AND viewport.width >= 768 DO
  ASSERT ExamPage_original(device).fullscreenEnforced = ExamPage_fixed(device).fullscreenEnforced
END FOR

// Desktop sidebar layout preserved
FOR ALL viewport WHERE viewport.width >= 1024 DO
  ASSERT ExamPage_original(viewport).sidebarVisible = ExamPage_fixed(viewport).sidebarVisible
END FOR

// Violation tracking unchanged
FOR ALL violation DO
  ASSERT recordViolation_original(violation) = recordViolation_fixed(violation)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for desktop fullscreen, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Desktop Fullscreen Preservation**: Verify desktop Chrome shows fullscreen overlay on unfixed AND fixed code
2. **Sidebar Layout Preservation**: Verify 1024px+ viewport shows sidebar on both versions
3. **Violation POST Preservation**: Verify violation API calls continue to work identically

### Unit Tests

- Test `isMobileDevice()` function with various user agents / touch capabilities
- Test `useAntiCheat` hook initialization with `initialViolationCount` prop
- Test `ExamTakingService.startExam` returns `violationCount` field
- Test `ExamTakingService.getExamState` returns `violationCount` from DB
- Test responsive CSS calculations at various viewport widths

### Property-Based Tests

- Generate random device configurations (touch/no-touch, various screen widths)
- Assert: mobile devices never see blocking fullscreen overlay
- Assert: desktop devices with standard anti-cheat always see fullscreen overlay when not fullscreen
- Generate random violation counts (0-100) and verify sync from server to client
- Generate random viewport widths (320-1440px) and verify no horizontal overflow below 768px

### Integration Tests

- Full flow: Mobile user loads exam → completes exam → submits (no fullscreen blocking)
- Full flow: User with 5 violations refreshes → banner shows 5 → adds violation → banner shows 6
- Full flow: Resize browser from 1200px to 400px → layout adapts → all buttons accessible
- WebSocket: Proctor sees violation update when student triggers one (preservation)
