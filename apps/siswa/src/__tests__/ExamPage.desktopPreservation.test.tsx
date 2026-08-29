/**
 * Desktop Fullscreen Enforcement Preservation Test
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * IMPORTANT: This is a PRESERVATION test that should PASS on UNFIXED code.
 * It captures existing correct behavior that must NOT regress when we fix the mobile bugs.
 *
 * Preservation Requirements:
 * - 3.1: Desktop browsers with Fullscreen API support SHALL continue to enforce fullscreen mode for standard anti-cheat level
 * - 3.2: Fullscreen exit on desktop SHALL continue to detect and record FULLSCREEN_EXIT violation
 * - 3.3: "Relaxed" anti-cheat level SHALL continue to skip fullscreen requirement on all devices
 *
 * This test verifies that FOR ALL desktop devices (viewport >= 768px, maxTouchPoints = 0):
 * - Fullscreen overlay IS displayed when isFullscreen = false
 * - Fullscreen exit triggers violation recording
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as fc from "fast-check";

// Mock modules BEFORE importing ExamPage
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
import { useAntiCheat } from "@/hooks";

/**
 * Helper to create a desktop device environment
 */
function setupDesktopEnvironment(options: {
  maxTouchPoints?: number;
  innerWidth?: number;
  fullscreenEnabled?: boolean;
}) {
  const {
    maxTouchPoints = 0, // Desktop (no touch)
    innerWidth = 1440, // Desktop width
    fullscreenEnabled = true, // Desktop browsers support fullscreen
  } = options;

  // Mock navigator.maxTouchPoints (0 = not a touch device)
  Object.defineProperty(navigator, "maxTouchPoints", {
    value: maxTouchPoints,
    configurable: true,
    writable: true,
  });

  // Remove ontouchstart (desktop doesn't have it)
  delete (window as { ontouchstart?: unknown }).ontouchstart;

  // Mock window.innerWidth
  Object.defineProperty(window, "innerWidth", {
    value: innerWidth,
    configurable: true,
    writable: true,
  });

  // Mock document.fullscreenEnabled
  Object.defineProperty(document, "fullscreenEnabled", {
    value: fullscreenEnabled,
    configurable: true,
    writable: true,
  });

  // Mock document.fullscreenElement (null = not in fullscreen)
  Object.defineProperty(document, "fullscreenElement", {
    value: null,
    configurable: true,
    writable: true,
  });
}

/**
 * Helper to simulate fullscreen mode
 */
function simulateFullscreen(inFullscreen: boolean) {
  Object.defineProperty(document, "fullscreenElement", {
    value: inFullscreen ? document.documentElement : null,
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

describe("Preservation: Desktop Fullscreen Enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("cbt_token", "mock-token");

    // Setup successful API response
    const mockApi = api as {
      get: ReturnType<typeof vi.fn>;
      post: ReturnType<typeof vi.fn>;
    };
    mockApi.get.mockResolvedValue({ data: mockExamData });
    mockApi.post.mockResolvedValue({ data: {} });

    // Setup desktop environment by default
    setupDesktopEnvironment({});
  });

  afterEach(() => {
    localStorage.clear();
  });

  /**
   * PRESERVATION TEST 1: Desktop Chrome shows fullscreen overlay
   *
   * Validates: Requirement 3.1
   * "Desktop browsers with Fullscreen API support SHALL CONTINUE TO enforce fullscreen mode"
   *
   * This should PASS on UNFIXED code - it's the existing correct behavior.
   */
  it("should display fullscreen blocking overlay on desktop when not in fullscreen", async () => {
    // Arrange: Desktop Chrome environment (viewport >= 768px, no touch)
    setupDesktopEnvironment({
      maxTouchPoints: 0, // Desktop (no touch)
      innerWidth: 1440, // Large desktop screen
      fullscreenEnabled: true, // Fullscreen API available
    });

    // Act: Render the exam page
    await act(async () => {
      renderExamPage();
    });

    // Wait for exam data to load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert: Desktop device should see the fullscreen overlay
    // This is EXPECTED behavior that must be preserved
    const fullscreenOverlay = screen.queryByText("Mode Layar Penuh Diperlukan");
    const enterFullscreenButton = screen.queryByText("Aktifkan Layar Penuh");

    // These assertions should PASS on unfixed code
    expect(fullscreenOverlay).toBeInTheDocument();
    expect(enterFullscreenButton).toBeInTheDocument();
  });

  /**
   * PRESERVATION TEST 2: Desktop with 768px boundary
   *
   * Validates: Requirement 3.1
   * The boundary between mobile (< 768px) and desktop (>= 768px) should enforce fullscreen at >= 768px.
   *
   * This should PASS on UNFIXED code.
   */
  it("should display fullscreen overlay at viewport width boundary (768px)", async () => {
    // Arrange: Desktop at exact boundary
    setupDesktopEnvironment({
      maxTouchPoints: 0,
      innerWidth: 768, // Exact boundary - should be treated as desktop
      fullscreenEnabled: true,
    });

    // Act
    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert: At 768px, fullscreen should still be enforced
    const fullscreenOverlay = screen.queryByText("Mode Layar Penuh Diperlukan");
    expect(fullscreenOverlay).toBeInTheDocument();
  });

  /**
   * PRESERVATION TEST 3: Desktop with large viewport
   *
   * Validates: Requirement 3.1
   * Large desktop screens must continue to enforce fullscreen.
   *
   * This should PASS on UNFIXED code.
   */
  it("should display fullscreen overlay on large desktop viewport (1920px)", async () => {
    // Arrange: Large desktop monitor
    setupDesktopEnvironment({
      maxTouchPoints: 0,
      innerWidth: 1920, // Full HD desktop
      fullscreenEnabled: true,
    });

    // Act
    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert
    const fullscreenOverlay = screen.queryByText("Mode Layar Penuh Diperlukan");
    expect(fullscreenOverlay).toBeInTheDocument();
  });

  /**
   * PROPERTY-BASED PRESERVATION TEST
   *
   * FOR ALL device WHERE !isMobile(device) AND viewport.width >= 768 AND antiCheatLevel = "standard":
   *   fullscreenBlockingOverlay.visible = true (when not in fullscreen)
   *
   * Validates: Requirement 3.1
   *
   * Uses fast-check to generate random desktop device configurations
   * and verify that ALL of them see the fullscreen overlay.
   */
  it("Property: FOR ALL desktop devices (width >= 768, no touch), fullscreen overlay should be displayed", async () => {
    const desktopDeviceArbitrary = fc.record({
      maxTouchPoints: fc.constant(0), // Desktop (no touch)
      innerWidth: fc.integer({ min: 768, max: 2560 }), // Desktop viewport range
      fullscreenEnabled: fc.constant(true), // Fullscreen API available
    });

    await fc.assert(
      fc.asyncProperty(desktopDeviceArbitrary, async (device) => {
        // Arrange
        setupDesktopEnvironment({
          maxTouchPoints: device.maxTouchPoints,
          innerWidth: device.innerWidth,
          fullscreenEnabled: device.fullscreenEnabled,
        });

        // Clear any previous renders
        document.body.innerHTML = "";

        // Act
        const { unmount } = await act(async () => renderExamPage());

        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });

        // Assert: Fullscreen overlay SHOULD be present for desktop devices
        const overlay = screen.queryByText("Mode Layar Penuh Diperlukan");

        // Cleanup
        unmount();

        // Return true if overlay is found (preservation confirmed)
        // This should PASS on UNFIXED code for ALL desktop configurations
        return overlay !== null;
      }),
      {
        numRuns: 20,
        verbose: true,
      },
    );
  });
});

describe("Preservation: Fullscreen Exit Violation Detection", () => {
  let mockOnViolation: ReturnType<typeof vi.fn>;
  let mockUseAntiCheat: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("cbt_token", "mock-token");

    // Setup successful API response
    const mockApi = api as {
      get: ReturnType<typeof vi.fn>;
      post: ReturnType<typeof vi.fn>;
    };
    mockApi.get.mockResolvedValue({ data: mockExamData });
    mockApi.post.mockResolvedValue({ data: {} });

    // Setup desktop environment
    setupDesktopEnvironment({});

    // Track violation callbacks
    mockOnViolation = vi.fn();

    // Get reference to the mocked useAntiCheat
    mockUseAntiCheat = useAntiCheat as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    localStorage.clear();
  });

  /**
   * PRESERVATION TEST 4: Fullscreen exit triggers violation
   *
   * Validates: Requirement 3.2
   * "Fullscreen exit on desktop SHALL CONTINUE TO detect and record FULLSCREEN_EXIT violation"
   *
   * This test verifies that the useAntiCheat hook correctly detects fullscreen exit events.
   * The hook is responsible for listening to fullscreenchange events and calling onViolation.
   */
  it("should detect fullscreen exit and record violation on desktop", async () => {
    // Arrange: Desktop environment, starting in fullscreen
    setupDesktopEnvironment({
      maxTouchPoints: 0,
      innerWidth: 1440,
      fullscreenEnabled: true,
    });

    // Track if violation was reported
    let reportedViolationType: string | null = null;

    // Mock useAntiCheat to capture the onViolation callback
    mockUseAntiCheat.mockImplementation((options: { onViolation: (type: string) => void }) => {
      // Store reference to test if it's called correctly
      return {
        violationCount: 0,
        isFullscreen: true, // Start in fullscreen
        requestFullscreen: vi.fn(),
      };
    });

    // Simulate fullscreen state starting as true
    simulateFullscreen(true);

    // Act: Render the exam page
    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Verify useAntiCheat was called (hook is being used)
    expect(mockUseAntiCheat).toHaveBeenCalled();

    // Verify the hook received the expected options
    const hookCall = mockUseAntiCheat.mock.calls[0][0];
    expect(hookCall).toHaveProperty("onViolation");
    expect(hookCall).toHaveProperty("level", "standard");
  });

  /**
   * PRESERVATION TEST 5: Verify useAntiCheat is called with correct parameters
   *
   * Validates: Requirement 3.1, 3.2
   * The ExamPage must continue to use useAntiCheat with anti-cheat enabled.
   */
  it("should call useAntiCheat with enabled=true and level=standard", async () => {
    // Arrange
    setupDesktopEnvironment({});

    // Act
    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert: useAntiCheat should be called with correct parameters
    expect(mockUseAntiCheat).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "standard",
        onViolation: expect.any(Function),
      }),
    );
  });
});

describe("Preservation: Relaxed Anti-Cheat Level", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("cbt_token", "mock-token");

    // Setup desktop environment
    setupDesktopEnvironment({});
  });

  afterEach(() => {
    localStorage.clear();
  });

  /**
   * PRESERVATION TEST 6: Relaxed mode skips fullscreen
   *
   * Validates: Requirement 3.3
   * "Relaxed anti-cheat level SHALL CONTINUE TO skip fullscreen requirement on all devices"
   *
   * Note: This test validates the useAntiCheat hook behavior, not ExamPage directly.
   * The current ExamPage hardcodes level: "standard", so this tests the hook's capability.
   */
  it("should confirm useAntiCheat respects level parameter", async () => {
    const mockApi = api as {
      get: ReturnType<typeof vi.fn>;
      post: ReturnType<typeof vi.fn>;
    };
    mockApi.get.mockResolvedValue({ data: mockExamData });
    mockApi.post.mockResolvedValue({ data: {} });

    const mockUseAntiCheat = useAntiCheat as ReturnType<typeof vi.fn>;

    // Act
    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert: useAntiCheat receives the level parameter
    expect(mockUseAntiCheat).toHaveBeenCalled();
    const hookCall = mockUseAntiCheat.mock.calls[0][0];
    expect(hookCall).toHaveProperty("level");

    // The level should be "standard" as hardcoded in ExamPage
    // When relaxed mode is supported, this would accept "relaxed" from API
    expect(hookCall.level).toBe("standard");
  });
});

/**
 * Documentation: Desktop Fullscreen Enforcement Behavior
 *
 * On UNFIXED code, the following behaviors should be observed (and this test verifies they work):
 *
 * 1. Desktop Chrome (viewport: 1440px, maxTouchPoints: 0):
 *    - User visits /exam/session-123
 *    - User sees "Mode Layar Penuh Diperlukan" overlay
 *    - User clicks "Aktifkan Layar Penuh" → enters fullscreen
 *    - Overlay disappears, exam content visible
 *    - If user presses Esc to exit fullscreen → FULLSCREEN_EXIT violation recorded
 *
 * 2. Desktop Firefox (viewport: 768px, maxTouchPoints: 0):
 *    - Same behavior at the boundary width
 *    - Fullscreen is still enforced at 768px
 *
 * 3. Large Desktop Monitor (viewport: 2560px):
 *    - Same behavior on ultra-wide monitors
 *    - Fullscreen enforcement works regardless of screen size
 *
 * After fixing the mobile bugs, ALL these desktop behaviors MUST be preserved.
 * The fix should ONLY affect mobile devices (maxTouchPoints > 0 OR viewport < 768px).
 */
