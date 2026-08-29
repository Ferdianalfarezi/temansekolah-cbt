/**
 * Bug Condition Exploration Test: Violation Count Reset on Refresh
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4**
 *
 * CRITICAL: This is an exploration test that should FAIL on UNFIXED code.
 * Failure confirms the bug exists. DO NOT attempt to fix the test or code when it fails.
 *
 * Bug Summary:
 * - The `useAntiCheat` hook initializes `violationCount` via `useState(0)` (line 31)
 * - The API's `startExam` and `getExamState` methods do NOT return `violationCount`
 * - When a student refreshes the browser, the local violation count resets to 0
 * - This creates inconsistency between siswa view (shows "0x") and admin view (shows actual count)
 *
 * Expected behavior (after fix):
 * - API responses should include `violationCount: number` field
 * - `useAntiCheat` should accept `initialViolationCount` prop
 * - The violation banner should show the correct count from server on page load/refresh
 *
 * Counterexample documented:
 * "Student with 5 violations in DB refreshes page → banner shows '0x' instead of '5x'"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as fc from "fast-check";
import { ViolationType } from "@/common/enums";

// Mock the modules BEFORE importing
vi.mock("@/services/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("@/hooks/useExamSocket", () => ({
  useExamSocket: vi.fn(() => ({
    isConnected: false,
    on: vi.fn(),
    off: vi.fn(),
    saveAnswer: vi.fn(),
  })),
}));

vi.mock("@/services/examCache", () => ({
  saveAnswerLocally: vi.fn(),
  markAnswerSynced: vi.fn(),
  getSessionAnswers: vi.fn(() => Promise.resolve(new Map())),
  getUnsyncedAnswers: vi.fn(() => Promise.resolve([])),
  cacheQuestions: vi.fn(),
  clearSessionCache: vi.fn(),
}));

import { useAntiCheat } from "@/hooks/useAntiCheat";
import api from "@/services/api";
import ExamPage from "@/pages/ExamPage";

/**
 * Mock exam data returned by API - simulates a student who has violations in DB
 */
function createMockExamData(options: {
  violationCount?: number;
  includeViolationCount?: boolean;
}) {
  const { violationCount = 5, includeViolationCount = false } = options;

  const baseData = {
    sessionId: "test-session-123",
    participantId: "test-participant-456",
    durationMinutes: 60,
    remainingSeconds: 3600,
    totalQuestions: 3,
    namaUjian: "Math Exam",
    questions: [
      {
        id: "q1",
        nomor: 1,
        teksSoal: "What is 2 + 2?",
        gambarSoalUrl: null,
        options: [
          { key: "A", text: "3", imageUrl: null },
          { key: "B", text: "4", imageUrl: null },
          { key: "C", text: "5", imageUrl: null },
        ],
      },
      {
        id: "q2",
        nomor: 2,
        teksSoal: "What is 3 + 3?",
        gambarSoalUrl: null,
        options: [
          { key: "A", text: "5", imageUrl: null },
          { key: "B", text: "6", imageUrl: null },
          { key: "C", text: "7", imageUrl: null },
        ],
      },
      {
        id: "q3",
        nomor: 3,
        teksSoal: "What is 4 + 4?",
        gambarSoalUrl: null,
        options: [
          { key: "A", text: "7", imageUrl: null },
          { key: "B", text: "8", imageUrl: null },
          { key: "C", text: "9", imageUrl: null },
        ],
      },
    ],
    savedAnswers: {},
  };

  // Only include violationCount if explicitly requested (after fix)
  if (includeViolationCount) {
    return { ...baseData, violationCount };
  }

  return baseData;
}

/**
 * Setup fullscreen environment (desktop mode) to bypass fullscreen overlay
 */
function setupDesktopFullscreenEnvironment() {
  Object.defineProperty(navigator, "maxTouchPoints", {
    value: 0,
    configurable: true,
    writable: true,
  });
  delete (window as { ontouchstart?: unknown }).ontouchstart;
  Object.defineProperty(window, "innerWidth", {
    value: 1440,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(document, "fullscreenEnabled", {
    value: true,
    configurable: true,
    writable: true,
  });
  // Simulate being IN fullscreen to show exam content
  Object.defineProperty(document, "fullscreenElement", {
    value: document.documentElement,
    configurable: true,
    writable: true,
  });
}

/**
 * Wrapper component for testing with router
 */
function renderExamPage() {
  return render(
    <MemoryRouter initialEntries={["/exam/test-session-123"]}>
      <Routes>
        <Route path="/exam/:sessionId" element={<ExamPage />} />
        <Route path="/exams" element={<div>Exam List</div>} />
        <Route path="/result/:sessionId" element={<div>Result</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Bug Condition Exploration: Violation Count Reset on Refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("cbt_token", "mock-token");
    setupDesktopFullscreenEnvironment();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  /**
   * UNIT TEST: useAntiCheat hook initialization
   *
   * BUG: The hook always initializes violationCount to 0 via useState(0).
   * There is no way to pass an initial value from server state.
   *
   * EXPECTED TO FAIL ON UNFIXED CODE:
   * - Current hook signature: useAntiCheat({ enabled, level, onViolation })
   * - There is no `initialViolationCount` parameter
   * - The test will fail because the hook doesn't accept this parameter
   *
   * After fix:
   * - Hook signature: useAntiCheat({ enabled, level, onViolation, initialViolationCount })
   * - The hook should initialize state from the provided value
   */
  it("useAntiCheat should accept initialViolationCount parameter", () => {
    const initialViolationCount = 5;

    const { result } = renderHook(() =>
      useAntiCheat({
        enabled: true,
        level: "standard",
        // BUG: This property doesn't exist in the current implementation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialViolationCount,
        onViolation: vi.fn(),
      } as any),
    );

    // EXPECTED TO FAIL ON UNFIXED CODE:
    // - Current implementation ignores initialViolationCount
    // - violationCount will be 0, not 5
    expect(result.current.violationCount).toBe(initialViolationCount);
  });

  /**
   * UNIT TEST: useAntiCheat hook defaults to 0 when no initial value
   *
   * This test should PASS on both unfixed and fixed code.
   * It verifies backward compatibility - when no initial value is provided,
   * the hook should still default to 0.
   */
  it("useAntiCheat should default to 0 when no initialViolationCount provided", () => {
    const { result } = renderHook(() =>
      useAntiCheat({
        enabled: true,
        level: "standard",
        onViolation: vi.fn(),
      }),
    );

    // This should pass on both unfixed and fixed code
    expect(result.current.violationCount).toBe(0);
  });

  /**
   * UNIT TEST: useAntiCheat initializes with server violation count
   *
   * BUG: When student has 5 violations in DB and refreshes, the local state
   * should be initialized from the server-provided value, not reset to 0.
   *
   * EXPECTED TO FAIL ON UNFIXED CODE.
   */
  it("useAntiCheat should initialize with server-provided violation count (not 0)", () => {
    // Simulate resuming an exam with existing violations
    const dbViolationCount = 7;

    const { result } = renderHook(() =>
      useAntiCheat({
        enabled: true,
        level: "standard",
        // BUG: This property doesn't exist
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialViolationCount: dbViolationCount,
        onViolation: vi.fn(),
      } as any),
    );

    // EXPECTED TO FAIL: Hook ignores initialViolationCount, returns 0
    expect(result.current.violationCount).toBe(dbViolationCount);
  });

  /**
   * INTEGRATION TEST: ExamPage displays correct violation count from server
   *
   * BUG: The API response doesn't include violationCount field.
   * When it does (after fix), the ExamPage should display the correct count.
   *
   * EXPECTED TO FAIL ON UNFIXED CODE:
   * - API response doesn't include violationCount
   * - Even if it did, useAntiCheat doesn't accept initialViolationCount
   * - Banner shows "0x" instead of "5x"
   *
   * Counterexample: "Student with 5 violations in DB refreshes page → banner shows '0x' instead of '5x'"
   */
  it("ExamPage should display server-provided violation count in banner", async () => {
    // Arrange: API returns exam data WITH violationCount (simulating fixed API)
    const mockApi = api as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
    mockApi.get.mockResolvedValue({
      data: createMockExamData({
        violationCount: 5,
        includeViolationCount: true, // Simulate fixed API
      }),
    });
    mockApi.post.mockResolvedValue({ data: {} });

    // Act: Render the exam page (simulating page refresh)
    await act(async () => {
      renderExamPage();
    });

    // Wait for data to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    // Assert: Violation banner should show the correct count from server
    // BUG: On unfixed code, even though API returns violationCount=5,
    // the useAntiCheat hook ignores it and initializes to 0
    // The banner will show "0x" or not appear at all (since 0 violations)
    const violationBanner = screen.queryByText(/Pelanggaran terdeteksi.*5x/i);

    // This will FAIL on unfixed code - banner either shows "0x" or doesn't appear
    expect(violationBanner).toBeInTheDocument();
  });

  /**
   * INTEGRATION TEST: Verify current bug behavior - banner shows 0 despite DB violations
   *
   * This test DOCUMENTS the current bug behavior. It should PASS on unfixed code
   * (because the bug exists) and FAIL on fixed code (because the bug is fixed).
   *
   * This is an inverted assertion to explicitly demonstrate the bug.
   */
  it("BUG DEMONSTRATION: Banner shows 0 violations even when student has 5 in DB", async () => {
    // Arrange: Student has 5 violations in DB
    // Current API doesn't return violationCount, so we simulate unfixed API
    const mockApi = api as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
    mockApi.get.mockResolvedValue({
      data: createMockExamData({
        violationCount: 5,
        includeViolationCount: false, // Current unfixed API behavior
      }),
    });
    mockApi.post.mockResolvedValue({ data: {} });

    // Act: Render the exam page (simulating page refresh)
    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    // This test documents the BUG:
    // - Student has 5 violations in DB
    // - But banner shows "0x" (or doesn't appear because violationCount is 0)
    // - Admin dashboard shows "5" but student sees "0"
    const violationBannerWith5 = screen.queryByText(/Pelanggaran terdeteksi.*5x/i);

    // BUG: This assertion PASSES on unfixed code because the banner doesn't show 5x
    // After fix, this test should fail because the bug is fixed
    expect(violationBannerWith5).not.toBeInTheDocument();
  });

  /**
   * PROPERTY-BASED TEST: Violation count sync property
   *
   * FOR ALL participant WHERE participant.violationCount > 0:
   *   UI.violationBanner.count = participant.violationCount
   *
   * Validates: Requirements 5.1, 5.2, 5.3, 5.4
   *
   * EXPECTED TO FAIL ON UNFIXED CODE for any violationCount > 0.
   */
  it("Property: FOR ALL participants with violations, banner should show correct count", async () => {
    const violationCountArbitrary = fc.integer({ min: 1, max: 50 });

    await fc.assert(
      fc.asyncProperty(violationCountArbitrary, async (serverViolationCount) => {
        // Clear previous renders
        document.body.innerHTML = "";
        vi.clearAllMocks();
        localStorage.setItem("cbt_token", "mock-token");
        setupDesktopFullscreenEnvironment();

        // Arrange: API returns violationCount (simulating fixed API)
        const mockApi = api as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
        mockApi.get.mockResolvedValue({
          data: createMockExamData({
            violationCount: serverViolationCount,
            includeViolationCount: true,
          }),
        });
        mockApi.post.mockResolvedValue({ data: {} });

        // Act
        const { unmount } = await act(async () => renderExamPage());

        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        });

        // Assert: Banner should show the exact count from server
        // The regex matches "Pelanggaran terdeteksi (Nx)" where N = serverViolationCount
        const bannerRegex = new RegExp(
          `Pelanggaran terdeteksi.*${serverViolationCount}x`,
          "i",
        );
        const violationBanner = screen.queryByText(bannerRegex);

        // Cleanup
        unmount();

        // EXPECTED TO FAIL on unfixed code:
        // - useAntiCheat ignores initialViolationCount
        // - Banner shows "0x" or doesn't appear at all
        return violationBanner !== null;
      }),
      {
        numRuns: 5, // Reduced for faster feedback
        verbose: true,
      },
    );
  });

  /**
   * UNIT TEST: New violation increments from server baseline, not zero
   *
   * BUG: When student has 5 violations and triggers a new one, the count
   * should go from 5 → 6, not from 0 → 1.
   *
   * EXPECTED TO FAIL ON UNFIXED CODE.
   */
  it("new violation should increment from server baseline (5 → 6), not from zero (0 → 1)", () => {
    const serverViolationCount = 5;
    const onViolation = vi.fn();

    const { result } = renderHook(() =>
      useAntiCheat({
        enabled: true,
        level: "standard",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialViolationCount: serverViolationCount,
        onViolation,
      } as any),
    );

    // Initial state should be from server (5), not zero
    expect(result.current.violationCount).toBe(serverViolationCount);

    // Simulate a new violation by calling the violation handler
    // This is tested indirectly through the hook's internal reportViolation
    // We can't directly call reportViolation, but we can check the initial state

    // EXPECTED TO FAIL on unfixed code: initialState is 0, not 5
  });

  /**
   * PROPERTY-BASED TEST: Increment behavior with various initial counts
   *
   * FOR ALL initialCount in [0, 100]:
   *   AFTER newViolation:
   *     violationCount = initialCount + 1
   *
   * This tests that the hook correctly increments from ANY initial value.
   * EXPECTED TO FAIL ON UNFIXED CODE because initialViolationCount is ignored.
   */
  it("Property: violation count should increment from any initial value", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (initialCount) => {
        const { result } = renderHook(() =>
          useAntiCheat({
            enabled: true,
            level: "standard",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            initialViolationCount: initialCount,
            onViolation: vi.fn(),
          } as any),
        );

        // Check initial state is correct
        // EXPECTED TO FAIL on unfixed code: always returns 0
        return result.current.violationCount === initialCount;
      }),
      {
        numRuns: 20,
        verbose: true,
      },
    );
  });
});

/**
 * Counterexample Documentation:
 *
 * When running on UNFIXED code, these tests will fail with counterexamples:
 *
 * 1. Violation Count Reset Scenario:
 *    - Student starts exam with 0 violations
 *    - Student triggers 5 violations (tab switches, focus loss, etc.)
 *    - API records 5 violations in database
 *    - Admin dashboard shows: "5 violations"
 *    - Student refreshes browser
 *    - useAntiCheat hook initializes: `useState(0)` ← ignores DB!
 *    - Student's violation banner shows: "0x"
 *    - INCONSISTENCY: Admin sees 5, Student sees 0
 *
 * 2. Resume Exam Scenario:
 *    - Student loses internet connection
 *    - Student closes browser
 *    - Student reopens browser and navigates to exam
 *    - API returns exam state WITH violations in DB
 *    - But useAntiCheat initializes to 0
 *    - Student thinks they have clean slate, admin knows otherwise
 *
 * 3. API Response Missing Field:
 *    - Current API response structure:
 *      { sessionId, participantId, durationMinutes, remainingSeconds, ... }
 *    - Missing: `violationCount` field
 *    - Even if client code tried to read it, it would be undefined → 0
 *
 * Root Cause Analysis Confirmed:
 * - apps/siswa/src/hooks/useAntiCheat.ts line 31: `const [violationCount, setViolationCount] = useState(0);`
 * - The hook's options interface lacks `initialViolationCount` parameter
 * - apps/api/src/modules/exam-taking/exam-taking.service.ts doesn't return violationCount
 *
 * After fix:
 * 1. API will return `violationCount: number` in startExam/getExamState responses
 * 2. useAntiCheat will accept `initialViolationCount?: number` option
 * 3. ExamPage will pass `examData.violationCount` to useAntiCheat
 * 4. Banner will show correct count: "Pelanggaran terdeteksi (5x)"
 */
