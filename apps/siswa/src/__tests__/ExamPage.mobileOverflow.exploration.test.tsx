/**
 * Bug Condition Exploration Test: Mobile UI Navigation Overflow
 *
 * **Validates: Requirements 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4**
 *
 * CRITICAL: This is an exploration test that should FAIL on UNFIXED code.
 * Failure confirms the bug exists. DO NOT attempt to fix the test or code when it fails.
 *
 * Bug Summary:
 * - On viewport < 768px, the navigation panel and footer buttons overflow beyond viewport
 * - "SOAL 1 DARI 12" text shows as "DARI 12" (left portion hidden/cut off)
 * - "Kumpulkan" button is positioned outside visible area, requiring horizontal scroll
 * - Question number grid is not accessible without scrolling horizontally
 * - Footer uses fixed padding (14px 24px) and buttons don't wrap on narrow screens
 *
 * Expected behavior (after fix):
 * - Navigation panel displayed as collapsible bottom sheet or slide-in drawer
 * - All interactive elements (question navigation, submit button, timer) accessible without horizontal scroll
 * - Footer buttons should wrap or be abbreviated on mobile
 *
 * Counterexample documented:
 * "Navigation buttons overflow right edge, requiring horizontal scroll"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
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

/**
 * Helper to setup viewport environment
 */
function setupViewport(width: number) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
    writable: true,
  });

  // Trigger resize event to notify any listeners
  window.dispatchEvent(new Event("resize"));
}

/**
 * Helper to setup mobile environment for testing (bypass fullscreen overlay)
 */
function setupMobileEnvironmentForLayoutTest(viewportWidth: number) {
  setupViewport(viewportWidth);

  // Set touch device indicators to bypass fullscreen overlay
  Object.defineProperty(navigator, "maxTouchPoints", {
    value: 2,
    configurable: true,
    writable: true,
  });

  Object.defineProperty(window, "ontouchstart", {
    value: () => {},
    configurable: true,
    writable: true,
  });

  // Mock fullscreen state - pretend we're in fullscreen to bypass overlay
  // This is necessary because the overlay blocks the footer we want to test
  Object.defineProperty(document, "fullscreenElement", {
    value: document.documentElement, // Pretend we're in fullscreen
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
 * Helper to restore desktop environment
 */
function restoreEnvironment() {
  Object.defineProperty(window, "innerWidth", {
    value: 1440,
    configurable: true,
    writable: true,
  });

  Object.defineProperty(navigator, "maxTouchPoints", {
    value: 0,
    configurable: true,
    writable: true,
  });

  delete (window as { ontouchstart?: unknown }).ontouchstart;

  Object.defineProperty(document, "fullscreenElement", {
    value: null,
    configurable: true,
    writable: true,
  });
}

/**
 * Mock exam data returned by API - with more questions to test navigation overflow
 */
const mockExamData = {
  sessionId: "test-session-123",
  participantId: "test-participant-456",
  durationMinutes: 60,
  remainingSeconds: 3600,
  totalQuestions: 12,
  namaUjian: "Ujian Matematika Semester 1",
  questions: Array.from({ length: 12 }, (_, i) => ({
    id: `q${i + 1}`,
    nomor: i + 1,
    teksSoal: `Pertanyaan nomor ${i + 1}: Berapakah hasil dari ${i + 1} × ${i + 2}?`,
    gambarSoalUrl: null,
    options: [
      { key: "A", text: `${(i + 1) * (i + 2) - 1}`, imageUrl: null },
      { key: "B", text: `${(i + 1) * (i + 2)}`, imageUrl: null },
      { key: "C", text: `${(i + 1) * (i + 2) + 1}`, imageUrl: null },
      { key: "D", text: `${(i + 1) * (i + 2) + 2}`, imageUrl: null },
    ],
  })),
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

/**
 * Helper to extract inline style value
 */
function getInlineStyleValue(
  element: HTMLElement,
  property: string,
): string | null {
  const style = element.getAttribute("style");
  if (!style) return null;

  const regex = new RegExp(`${property}\\s*:\\s*([^;]+)`);
  const match = style.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Helper to calculate estimated minimum width needed for text content
 * Assumes ~8px per character as rough estimate for button text
 */
function estimateTextWidth(text: string, fontSize: number = 14): number {
  // Average character width is roughly 0.5-0.6 of font size
  return text.length * (fontSize * 0.55);
}

/**
 * Helper to calculate minimum button width from padding + text
 */
function estimateButtonMinWidth(
  text: string,
  paddingHorizontal: number,
  fontSize: number = 14,
): number {
  const textWidth = estimateTextWidth(text, fontSize);
  return textWidth + paddingHorizontal * 2;
}

describe("Bug Condition Exploration: Mobile UI Navigation Overflow", () => {
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
  });

  afterEach(() => {
    restoreEnvironment();
    localStorage.clear();
    document.body.innerHTML = "";
  });

  /**
   * BUG CONDITION TEST 1: Footer has fixed padding that doesn't adapt to mobile
   *
   * EXPECTED TO FAIL ON UNFIXED CODE:
   * The footer uses hardcoded `padding: "14px 24px"` regardless of viewport width.
   * On a 375px viewport, 48px of horizontal padding wastes significant space.
   *
   * Expected behavior (after fix): padding should be responsive:
   * `padding: isMobile ? "12px 16px" : "14px 24px"`
   *
   * Counterexample: "Footer has padding: 14px 24px on 375px viewport, wasting 48px of horizontal space"
   */
  it("should have responsive footer padding on mobile viewport (not fixed 14px 24px)", async () => {
    // Arrange: Setup mobile viewport
    setupMobileEnvironmentForLayoutTest(375);

    // Act
    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert: Footer should NOT have fixed desktop padding on mobile
    const footer = document.querySelector("footer");
    expect(footer).not.toBeNull();

    if (footer) {
      const padding = getInlineStyleValue(footer as HTMLElement, "padding");

      // BUG: On unfixed code, padding is "14px 24px" regardless of viewport
      // Expected after fix: reduced padding like "12px 16px" or responsive value
      // The test checks that the horizontal padding is NOT the desktop-optimized 24px

      // Extract horizontal padding value
      const horizontalPadding = padding?.match(/\d+px\s+(\d+)px/)?.[1];

      // This will FAIL on unfixed code (padding is 24px)
      // After fix, should be <= 16px on mobile
      expect(Number(horizontalPadding || 24)).toBeLessThanOrEqual(16);
    }
  });

  /**
   * BUG CONDITION TEST 2: Navigation button text is not abbreviated on mobile
   *
   * EXPECTED TO FAIL ON UNFIXED CODE:
   * Buttons show full text "← Sebelumnya" and "Selanjutnya →" on mobile.
   * These long texts plus padding cause overflow on narrow viewports.
   *
   * Expected behavior (after fix): buttons abbreviated on mobile:
   * "← Sebelumnya" → "←" or "Sblm"
   * "Selanjutnya →" → "→" or "Slnjt"
   *
   * Counterexample: "Navigation buttons display full '← Sebelumnya' and 'Selanjutnya →'
   * text on 375px viewport instead of abbreviated mobile versions"
   */
  it("should abbreviate navigation button text on mobile viewport", async () => {
    // Arrange: Setup mobile viewport
    setupMobileEnvironmentForLayoutTest(375);

    // Act
    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert: Navigation buttons should use abbreviated text on mobile
    // BUG: On unfixed code, buttons show full "← Sebelumnya" and "Selanjutnya →"

    // Look for the full-length button text (should NOT exist on mobile after fix)
    const prevButtonFull = screen.queryByRole("button", {
      name: /←\s*sebelumnya/i,
    });
    const nextButtonFull = screen.queryByRole("button", {
      name: /selanjutnya\s*→/i,
    });

    // On unfixed code, these will be found (FAIL expected)
    // After fix, buttons should have abbreviated text like "←" and "→"

    // This assertion will FAIL on unfixed code - full text buttons exist
    expect(prevButtonFull).toBeNull();
    expect(nextButtonFull).toBeNull();
  });

  /**
   * BUG CONDITION TEST 3: Footer buttons don't wrap (no flexWrap)
   *
   * EXPECTED TO FAIL ON UNFIXED CODE:
   * The footer uses `display: flex` with `justify-content: space-between` but no `flex-wrap`.
   * When content exceeds viewport width, it overflows instead of wrapping.
   *
   * Expected behavior (after fix): footer should have `flexWrap: "wrap"`
   *
   * Counterexample: "Footer style lacks flexWrap property, causing overflow on narrow viewports"
   */
  it("should have flexWrap on footer to prevent overflow on mobile", async () => {
    // Arrange: Setup mobile viewport
    setupMobileEnvironmentForLayoutTest(375);

    // Act
    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert: Footer should have flexWrap to handle overflow gracefully
    const footer = document.querySelector("footer");
    expect(footer).not.toBeNull();

    if (footer) {
      const flexWrap = getInlineStyleValue(footer as HTMLElement, "flex-wrap");

      // BUG: On unfixed code, there's no flexWrap property
      // After fix, should have flexWrap: "wrap"
      // This will FAIL on unfixed code (flexWrap is null/undefined)
      expect(flexWrap).toBe("wrap");
    }
  });

  /**
   * BUG CONDITION TEST 4: Main container lacks overflow protection
   *
   * EXPECTED TO FAIL ON UNFIXED CODE:
   * The main container doesn't have `maxWidth: "100vw"` or `overflowX: "hidden"`.
   * This allows content to extend beyond viewport, creating horizontal scroll.
   *
   * Expected behavior (after fix):
   * - `maxWidth: "100vw"` to constrain width
   * - `overflowX: "hidden"` to hide any accidental overflow
   *
   * Counterexample: "Root container missing maxWidth: 100vw and overflowX: hidden,
   * allowing horizontal overflow"
   */
  it("should have viewport containment on main container to prevent horizontal scroll", async () => {
    // Arrange: Setup mobile viewport
    setupMobileEnvironmentForLayoutTest(375);

    // Act
    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert: Root container should have overflow protection
    // Find the root div with min-h-screen equivalent style
    const rootContainer = document.querySelector(
      'div[style*="min-height"]',
    ) as HTMLElement;

    if (rootContainer) {
      const maxWidth = getInlineStyleValue(rootContainer, "max-width");
      const overflowX = getInlineStyleValue(rootContainer, "overflow-x");

      // BUG: On unfixed code, these properties are not set
      // After fix, should have maxWidth: "100vw" and overflowX: "hidden"

      // This will FAIL on unfixed code
      expect(maxWidth).toBe("100vw");
      expect(overflowX).toBe("hidden");
    }
  });

  /**
   * BUG CONDITION TEST 5: Button padding is not responsive
   *
   * EXPECTED TO FAIL ON UNFIXED CODE:
   * Footer buttons have fixed `padding: "10px 20px"` on all viewports.
   * On mobile, this padding should be reduced to `padding: "8px 12px"`.
   *
   * Counterexample: "Footer buttons have padding: 10px 20px on 375px viewport
   * instead of reduced mobile padding"
   */
  it("should have reduced button padding on mobile viewport", async () => {
    // Arrange: Setup mobile viewport
    setupMobileEnvironmentForLayoutTest(375);

    // Act
    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert: Footer buttons should have reduced padding on mobile
    const footer = document.querySelector("footer");
    if (!footer) {
      throw new Error("Footer not found");
    }

    // Find all buttons in footer
    const footerButtons = footer.querySelectorAll("button");
    expect(footerButtons.length).toBeGreaterThan(0);

    // Check the prev/next navigation buttons (first and one of the last)
    const buttons = Array.from(footerButtons);

    buttons.forEach((button) => {
      const padding = getInlineStyleValue(button as HTMLElement, "padding");

      // Extract horizontal padding from "Xpx Ypx" format
      const horizontalPadding = padding?.match(/\d+px\s+(\d+)px/)?.[1];

      // BUG: On unfixed code, horizontal padding is 20px
      // After fix, should be 12px or less on mobile
      // This will FAIL on unfixed code
      if (horizontalPadding) {
        expect(Number(horizontalPadding)).toBeLessThanOrEqual(12);
      }
    });
  });

  /**
   * BUG CONDITION TEST 6: Calculated minimum footer width exceeds mobile viewport
   *
   * EXPECTED TO FAIL ON UNFIXED CODE:
   * This test calculates the theoretical minimum width needed for footer elements
   * based on text content and padding, demonstrating that overflow is inevitable.
   *
   * Current layout analysis (unfixed):
   * - "← Sebelumnya" button: ~13 chars * 7px + 40px padding = ~131px
   * - Nav toggle "📋 1/12": ~7 chars * 7px + 24px padding = ~73px
   * - "Selanjutnya →" button: ~13 chars * 7px + 40px padding = ~131px
   * - "Kumpulkan" button: ~9 chars * 7px + 48px padding = ~111px
   * - Total: ~446px + gaps + footer padding = ~500px+
   * - Viewport: 375px
   * - Overflow: ~125px+
   *
   * Counterexample: "Footer content requires ~500px minimum width but viewport is only 375px"
   */
  it("should have footer content that fits within 375px mobile viewport", async () => {
    // Arrange: Setup mobile viewport
    setupMobileEnvironmentForLayoutTest(375);

    // Act
    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert: Calculate estimated minimum width needed for footer elements
    const footer = document.querySelector("footer");
    expect(footer).not.toBeNull();

    // Find button texts to calculate minimum widths needed
    const prevButton = screen.queryByRole("button", { name: /sebelumnya/i });
    const nextButton = screen.queryByRole("button", { name: /selanjutnya/i });
    const submitButton = screen.queryByRole("button", { name: /kumpulkan/i });
    const navToggle = screen.queryByText(/📋\s*\d+\/\d+/);

    // Extract text content
    const prevText = prevButton?.textContent || "← Sebelumnya";
    const nextText = nextButton?.textContent || "Selanjutnya →";
    const submitText = submitButton?.textContent || "Kumpulkan";
    const navText = navToggle?.textContent || "📋 1/12";

    // Calculate estimated minimum widths (text + padding)
    const prevWidth = estimateButtonMinWidth(prevText, 20);
    const nextWidth = estimateButtonMinWidth(nextText, 20);
    const submitWidth = estimateButtonMinWidth(submitText, 24);
    const navWidth = estimateButtonMinWidth(navText, 12);

    // Footer padding (24px each side)
    const footerPadding = 48;

    // Gaps between elements (8px gaps, ~3 gaps)
    const totalGaps = 24;

    // Total minimum width needed
    const totalMinWidth =
      prevWidth +
      navWidth +
      nextWidth +
      submitWidth +
      footerPadding +
      totalGaps;

    // BUG: On unfixed code, total exceeds 375px
    // After fix (with abbreviated text and reduced padding), should fit

    // This will FAIL on unfixed code - footer needs more than 375px
    // The expected fix involves abbreviated button text and reduced padding
    expect(totalMinWidth).toBeLessThanOrEqual(375);
  });

  /**
   * PROPERTY-BASED BUG CONDITION TEST
   *
   * FOR ALL viewport WHERE viewport.width < 768:
   *   footer.hasFlexWrap = true
   *   container.hasOverflowProtection = true
   *
   * Validates: Requirements 8.1, 8.2, 8.3, 8.4
   *
   * Uses fast-check to verify that responsive design properties are present
   * on mobile viewports.
   */
  it("Property: FOR ALL mobile viewports, responsive CSS properties should be present", async () => {
    const mobileViewportArbitrary = fc.integer({ min: 320, max: 767 });

    await fc.assert(
      fc.asyncProperty(mobileViewportArbitrary, async (viewportWidth) => {
        // Arrange
        setupMobileEnvironmentForLayoutTest(viewportWidth);

        // Clear any previous renders
        document.body.innerHTML = "";

        // Act
        const { unmount } = await act(async () => renderExamPage());

        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });

        // Assert: Check for required responsive properties
        const footer = document.querySelector("footer") as HTMLElement;
        const rootContainer = document.querySelector(
          'div[style*="min-height"]',
        ) as HTMLElement;

        let hasResponsiveProperties = true;

        // Check footer has flexWrap
        if (footer) {
          const flexWrap = getInlineStyleValue(footer, "flex-wrap");
          if (flexWrap !== "wrap") {
            hasResponsiveProperties = false;
          }
        }

        // Check root has overflow protection
        if (rootContainer) {
          const overflowX = getInlineStyleValue(rootContainer, "overflow-x");
          const maxWidth = getInlineStyleValue(rootContainer, "max-width");
          if (overflowX !== "hidden" || maxWidth !== "100vw") {
            hasResponsiveProperties = false;
          }
        }

        // Cleanup
        unmount();

        // Return false if responsive properties missing (bug confirmed)
        // This will FAIL on unfixed code for all mobile viewports
        return hasResponsiveProperties;
      }),
      {
        numRuns: 10,
        verbose: true,
      },
    );
  });
});

/**
 * Counterexample Documentation:
 *
 * When running on UNFIXED code, these tests will fail with counterexamples like:
 *
 * 1. iPhone SE (375px viewport):
 *    - Footer buttons: "← Sebelumnya" (~130px) + nav toggle (~60px) + "Selanjutnya →" (~130px) + "Kumpulkan" (~100px)
 *    - Total width needed: ~420px + gaps + padding
 *    - Available width: 375px
 *    - Result: "Kumpulkan" button extends beyond right edge
 *    - User must scroll horizontally to submit exam
 *
 * 2. Question indicator text truncation:
 *    - "SOAL 1 DARI 12" header has fixed positioning
 *    - On narrow viewport, left portion cut off showing only "DARI 12"
 *    - User cannot see which question they're on
 *
 * 3. Footer layout issues (root cause):
 *    - Footer uses `padding: "14px 24px"` (48px horizontal padding)
 *    - Buttons have `padding: "10px 20px"` with no abbreviation on mobile
 *    - Right button group `div { display: flex, gap: 8px }` doesn't wrap
 *    - No `flexWrap: "wrap"` on footer or button container
 *
 * After fix:
 * - Footer should have responsive padding: `padding: isMobile ? "12px 16px" : "14px 24px"`
 * - Buttons should abbreviate on mobile: "← Sebelumnya" → "←"
 * - Footer should use `flexWrap: "wrap"` to handle overflow
 * - Container should have `maxWidth: "100vw"` and `overflowX: "hidden"`
 */
