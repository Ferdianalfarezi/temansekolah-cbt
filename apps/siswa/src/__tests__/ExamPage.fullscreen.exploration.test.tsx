/**
 * Bug Condition Exploration Test: iOS/Mobile Fullscreen Blocking
 *
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
 *
 * CRITICAL: This is an exploration test that should FAIL on UNFIXED code.
 * Failure confirms the bug exists. DO NOT attempt to fix the test or code when it fails.
 *
 * Bug Summary:
 * - iOS Safari doesn't support the Fullscreen API (document.fullscreenEnabled = false)
 * - The ExamPage unconditionally renders a blocking fullscreen overlay when !isFullscreen
 * - On mobile/iOS, isFullscreen is always false, so users are permanently blocked
 *
 * Expected behavior (after fix):
 * - Mobile devices (navigator.maxTouchPoints > 0 OR window.innerWidth < 768) should
 *   bypass fullscreen enforcement and see exam content directly
 *
 * Counterexample documented:
 * "Mobile Safari user sees 'Mode Layar Penuh Diperlukan' overlay that cannot be dismissed"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as fc from "fast-check";

// We need to mock the modules BEFORE importing ExamPage
vi.mock("@/services/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("@/hooks", () => ({
  useAntiCheat: vi.fn(() => ({
    violationCount: 0,
    isFullscreen: false,
    requestFullscreen: vi.fn(),
  })),
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

import ExamPage from "@/pages/ExamPage";
import api from "@/services/api";

/**
 * Helper to create a mobile device environment
 */
function setupMobileEnvironment(options: {
  maxTouchPoints?: number;
  ontouchstart?: boolean;
  innerWidth?: number;
  fullscreenEnabled?: boolean;
}) {
  const {
    maxTouchPoints = 2,
    ontouchstart = true,
    innerWidth = 375, // iPhone SE width
    fullscreenEnabled = false,
  } = options;

  // Mock navigator.maxTouchPoints
  Object.defineProperty(navigator, "maxTouchPoints", {
    value: maxTouchPoints,
    configurable: true,
    writable: true,
  });

  // Mock ontouchstart in window
  if (ontouchstart) {
    Object.defineProperty(window, "ontouchstart", {
      value: () => {},
      configurable: true,
      writable: true,
    });
  } else {
    delete (window as { ontouchstart?: unknown }).ontouchstart;
  }

  // Mock window.innerWidth
  Object.defineProperty(window, "innerWidth", {
    value: innerWidth,
    configurable: true,
    writable: true,
  });

  // Mock document.fullscreenEnabled (iOS Safari = false)
  Object.defineProperty(document, "fullscreenEnabled", {
    value: fullscreenEnabled,
    configurable: true,
    writable: true,
  });

  // Mock document.fullscreenElement (always null on iOS)
  Object.defineProperty(document, "fullscreenElement", {
    value: null,
    configurable: true,
    writable: true,
  });
}

/**
 * Helper to restore desktop environment
 */
function setupDesktopEnvironment() {
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
}

/**
 * Mock exam data returned by API
 */
const mockExamData = {
  sessionId: "test-session-123",
  participantId: "test-participant-456",
  durationMinutes: 60,
  remainingSeconds: 3600,
  totalQuestions: 5,
  namaUjian: "Test Exam",
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
  ],
  savedAnswers: {},
};

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

describe("Bug Condition Exploration: iOS/Mobile Fullscreen Blocking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("cbt_token", "mock-token");

    // Setup successful API response
    const mockApi = api as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
    mockApi.get.mockResolvedValue({ data: mockExamData });
    mockApi.post.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    setupDesktopEnvironment();
    localStorage.clear();
  });

  /**
   * BUG CONDITION TEST 1: iOS Safari with touch device
   *
   * EXPECTED TO FAIL ON UNFIXED CODE:
   * The test asserts that mobile devices should NOT see the blocking overlay.
   * On unfixed code, mobile devices WILL see the overlay, causing test failure.
   * This failure confirms the bug exists.
   *
   * Counterexample: "Mobile Safari user (maxTouchPoints=2, fullscreenEnabled=false)
   * sees 'Mode Layar Penuh Diperlukan' overlay that cannot be dismissed"
   */
  it("should NOT display fullscreen blocking overlay on iOS Safari (touch device)", async () => {
    // Arrange: Setup iOS Safari environment
    setupMobileEnvironment({
      maxTouchPoints: 2, // Touch device
      ontouchstart: true,
      innerWidth: 390, // iPhone 12 width
      fullscreenEnabled: false, // iOS Safari doesn't support fullscreen
    });

    // Act: Render the exam page
    await act(async () => {
      renderExamPage();
    });

    // Wait for exam data to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert: Mobile device should NOT see the blocking fullscreen overlay
    // BUG: On unfixed code, this overlay IS displayed, blocking exam access
    const fullscreenOverlay = screen.queryByText("Mode Layar Penuh Diperlukan");

    // This assertion will FAIL on unfixed code (confirming bug exists)
    // Expected behavior after fix: overlay should NOT be present for mobile devices
    expect(fullscreenOverlay).not.toBeInTheDocument();
  });

  /**
   * BUG CONDITION TEST 2: Narrow viewport (< 768px)
   *
   * Even if maxTouchPoints is 0 (desktop with narrow window),
   * screens under 768px should bypass fullscreen enforcement.
   *
   * EXPECTED TO FAIL ON UNFIXED CODE.
   */
  it("should NOT display fullscreen blocking overlay on narrow viewport (< 768px)", async () => {
    // Arrange: Desktop device but narrow viewport (like mobile emulation)
    setupMobileEnvironment({
      maxTouchPoints: 0, // Not a touch device
      ontouchstart: false,
      innerWidth: 375, // iPhone SE width
      fullscreenEnabled: true, // Fullscreen API available
    });

    // Act
    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert: Narrow viewport should bypass fullscreen overlay
    const fullscreenOverlay = screen.queryByText("Mode Layar Penuh Diperlukan");

    // This will FAIL on unfixed code
    expect(fullscreenOverlay).not.toBeInTheDocument();
  });

  /**
   * BUG CONDITION TEST 3: Touch device with narrow screen
   *
   * Combined mobile indicators should definitely bypass fullscreen.
   *
   * EXPECTED TO FAIL ON UNFIXED CODE.
   */
  it("should NOT display fullscreen blocking overlay on mobile device (combined indicators)", async () => {
    // Arrange: Full mobile environment
    setupMobileEnvironment({
      maxTouchPoints: 5, // Multi-touch mobile device
      ontouchstart: true,
      innerWidth: 414, // iPhone XR width
      fullscreenEnabled: false, // iOS Safari
    });

    // Act
    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert: Should see exam content, not blocking overlay
    const fullscreenOverlay = screen.queryByText("Mode Layar Penuh Diperlukan");
    const enterFullscreenButton = screen.queryByText("Aktifkan Layar Penuh");

    // Both will FAIL on unfixed code
    expect(fullscreenOverlay).not.toBeInTheDocument();
    expect(enterFullscreenButton).not.toBeInTheDocument();
  });

  /**
   * PROPERTY-BASED BUG CONDITION TEST
   *
   * FOR ALL device WHERE isMobileDevice(device) = true:
   *   fullscreenBlockingOverlay.visible = false
   *
   * Validates: Requirements 2.1, 2.2
   *
   * Uses fast-check to generate random mobile device configurations
   * and verify that NONE of them see the blocking overlay.
   */
  it("Property: FOR ALL mobile devices, fullscreen overlay should NOT block exam access", async () => {
    const mobileDeviceArbitrary = fc.record({
      maxTouchPoints: fc.integer({ min: 1, max: 10 }), // Touch device
      innerWidth: fc.integer({ min: 320, max: 767 }), // Mobile viewport
      fullscreenEnabled: fc.constant(false), // iOS Safari
    });

    await fc.assert(
      fc.asyncProperty(mobileDeviceArbitrary, async (device) => {
        // Arrange
        setupMobileEnvironment({
          maxTouchPoints: device.maxTouchPoints,
          ontouchstart: true,
          innerWidth: device.innerWidth,
          fullscreenEnabled: device.fullscreenEnabled,
        });

        // Clear any previous renders
        const container = document.body;
        container.innerHTML = "";

        // Act
        const { unmount } = await act(async () => renderExamPage());

        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });

        // Assert: No blocking overlay for mobile devices
        const overlay = screen.queryByText("Mode Layar Penuh Diperlukan");

        // Cleanup
        unmount();

        // Return false if overlay is found (bug confirmed)
        // This will FAIL on unfixed code for ALL mobile device configurations
        return overlay === null;
      }),
      {
        numRuns: 10, // Reduced for faster feedback during exploration
        verbose: true,
      },
    );
  });

  /**
   * BUG CONDITION TEST 4: Verify "Aktifkan Layar Penuh" button is inaccessible on iOS
   *
   * On iOS Safari, the fullscreen button does nothing because fullscreenEnabled = false.
   * Users are trapped behind the overlay with no way to proceed.
   *
   * EXPECTED TO FAIL ON UNFIXED CODE.
   */
  it("should allow exam access without fullscreen button interaction on mobile", async () => {
    // Arrange: iOS Safari
    setupMobileEnvironment({
      maxTouchPoints: 2,
      ontouchstart: true,
      innerWidth: 390,
      fullscreenEnabled: false,
    });

    // Act
    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert: Exam content should be visible (not hidden behind overlay)
    // On unfixed code, this will be hidden by the blocking overlay
    const examQuestionIndicator = screen.queryByText(/Soal 1 dari/i);

    // This will FAIL on unfixed code because exam content is blocked
    expect(examQuestionIndicator).toBeInTheDocument();
  });
});

/**
 * Counterexample Documentation:
 *
 * When running on UNFIXED code, these tests will fail with counterexamples like:
 *
 * 1. iOS Safari (iPhone 12):
 *    - maxTouchPoints: 2
 *    - window.innerWidth: 390
 *    - document.fullscreenEnabled: false
 *    - document.fullscreenElement: null
 *    - User sees: "Mode Layar Penuh Diperlukan" overlay
 *    - User clicks "Aktifkan Layar Penuh" → nothing happens
 *    - User is BLOCKED from taking the exam
 *
 * 2. Android Chrome (Pixel 5):
 *    - maxTouchPoints: 5
 *    - window.innerWidth: 393
 *    - document.fullscreenEnabled: true (but hard to use)
 *    - User sees overlay, may be able to enter fullscreen but UX is poor
 *
 * 3. Desktop with narrow viewport (dev tools mobile emulation):
 *    - maxTouchPoints: 0
 *    - window.innerWidth: 375
 *    - document.fullscreenEnabled: true
 *    - User sees overlay, can enter fullscreen, but layout is broken
 *
 * After fix, all these scenarios should show exam content directly without
 * the blocking fullscreen overlay.
 */
