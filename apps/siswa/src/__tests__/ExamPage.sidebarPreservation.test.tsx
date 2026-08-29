/**
 * Preservation Test: Desktop Sidebar Layout
 *
 * **Validates: Requirements 9.1, 9.2, 9.3**
 *
 * IMPORTANT: This is a PRESERVATION test that should PASS on UNFIXED code.
 * It captures existing correct behavior that must not regress during the bugfix.
 *
 * Preserved Behavior:
 * - 9.1: Viewport width >= 1024px shows navigation sidebar as fixed right panel
 * - 9.2: User selects question from navigation, system navigates to that question
 * - 9.3: Timer displays in header area on all viewport sizes
 *
 * Test Strategy:
 * - Observe behavior on UNFIXED code first
 * - Write tests capturing that behavior
 * - These tests should PASS both before and after the fix
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, within } from "@testing-library/react";
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
    isFullscreen: true, // Desktop shows fullscreen mode
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
 * Helper to setup desktop environment with large viewport
 */
function setupDesktopEnvironment(viewportWidth = 1440) {
  Object.defineProperty(navigator, "maxTouchPoints", {
    value: 0,
    configurable: true,
    writable: true,
  });

  delete (window as { ontouchstart?: unknown }).ontouchstart;

  Object.defineProperty(window, "innerWidth", {
    value: viewportWidth,
    configurable: true,
    writable: true,
  });

  Object.defineProperty(window, "innerHeight", {
    value: 900,
    configurable: true,
    writable: true,
  });

  Object.defineProperty(document, "fullscreenEnabled", {
    value: true,
    configurable: true,
    writable: true,
  });

  // Simulate fullscreen mode for desktop tests
  Object.defineProperty(document, "fullscreenElement", {
    value: document.documentElement,
    configurable: true,
    writable: true,
  });
}

/**
 * Helper to reset environment
 */
function resetEnvironment() {
  Object.defineProperty(window, "innerWidth", {
    value: 1024,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(document, "fullscreenElement", {
    value: null,
    configurable: true,
    writable: true,
  });
}

/**
 * Mock exam data with multiple questions for navigation testing
 */
const mockExamDataWithQuestions = {
  sessionId: "test-session-123",
  participantId: "test-participant-456",
  durationMinutes: 60,
  remainingSeconds: 3600,
  totalQuestions: 12,
  namaUjian: "Ujian Matematika",
  questions: Array.from({ length: 12 }, (_, i) => ({
    id: `q${i + 1}`,
    nomor: i + 1,
    teksSoal: `Soal nomor ${i + 1}: Hitunglah hasil dari ${i + 1} × ${i + 2}`,
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

describe("Preservation: Desktop Sidebar Layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("cbt_token", "mock-token");

    // Setup successful API response
    const mockApi = api as {
      get: ReturnType<typeof vi.fn>;
      post: ReturnType<typeof vi.fn>;
    };
    mockApi.get.mockResolvedValue({ data: mockExamDataWithQuestions });
    mockApi.post.mockResolvedValue({ data: {} });

    // Default to desktop environment
    setupDesktopEnvironment(1440);
  });

  afterEach(() => {
    resetEnvironment();
    localStorage.clear();
  });

  /**
   * PRESERVATION TEST 1: Sidebar visible as fixed right panel on desktop
   *
   * **Validates: Requirement 9.1**
   * "WHEN viewport width is desktop size (>=1024px) THEN the navigation sidebar
   * layout SHALL CONTINUE TO display as fixed right panel"
   *
   * This test should PASS on both unfixed and fixed code.
   */
  it("should display navigation sidebar on viewport >= 1024px", async () => {
    // Arrange: Desktop viewport
    setupDesktopEnvironment(1200);

    // Act
    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert: Sidebar should be visible with "Navigasi Soal" header
    // The desktop sidebar has the "hidden lg:flex" class, making it visible at lg breakpoint (1024px+)
    const sidebar = screen.getByText("Navigasi Soal");
    expect(sidebar).toBeInTheDocument();
  });

  /**
   * PRESERVATION TEST 2: Question grid displays in sidebar
   *
   * **Validates: Requirement 9.1**
   *
   * The question grid (numbered buttons 1-12) should be visible in the sidebar
   * for desktop viewports.
   */
  it("should display question grid in sidebar for desktop viewport", async () => {
    // Arrange: Large desktop viewport
    setupDesktopEnvironment(1440);

    // Act
    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert: Question navigation buttons should be visible
    // Looking for numbered buttons 1-12 in the sidebar
    const button1 = screen.getAllByRole("button", { name: "1" })[0];
    const button5 = screen.getAllByRole("button", { name: "5" })[0];
    const button12 = screen.getAllByRole("button", { name: "12" })[0];

    expect(button1).toBeInTheDocument();
    expect(button5).toBeInTheDocument();
    expect(button12).toBeInTheDocument();
  });

  /**
   * PRESERVATION TEST 3: Clicking question in navigation updates current index
   *
   * **Validates: Requirement 9.2**
   * "WHEN user selects a question from navigation THEN the system SHALL
   * CONTINUE TO navigate to that question and update current index"
   */
  it("should navigate to selected question when clicking in sidebar", async () => {
    // Arrange
    setupDesktopEnvironment(1440);

    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Initial state: Should show "Soal 1 dari 12"
    expect(screen.getByText(/Soal 1 dari 12/i)).toBeInTheDocument();

    // Act: Click on question 5 in navigation
    const button5 = screen.getAllByRole("button", { name: "5" })[0];
    await act(async () => {
      fireEvent.click(button5);
    });

    // Assert: Should now show "Soal 5 dari 12"
    expect(screen.getByText(/Soal 5 dari 12/i)).toBeInTheDocument();
    // Should show question 5's content
    expect(screen.getByText(/Soal nomor 5/i)).toBeInTheDocument();
  });

  /**
   * PRESERVATION TEST 4: Timer displays in header area
   *
   * **Validates: Requirement 9.3**
   * "WHEN timer displays on mobile THEN it SHALL CONTINUE TO show correct
   * remaining time in header area"
   *
   * Timer should be visible on all viewports including desktop.
   */
  it("should display timer in header for desktop viewport", async () => {
    // Arrange: Desktop viewport
    setupDesktopEnvironment(1440);

    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert: Timer should be visible showing formatted time
    // 3600 seconds = 01:00:00 (HH:MM:SS format when hours > 0)
    const timerElement = screen.getByText("01:00:00");
    expect(timerElement).toBeInTheDocument();
  });

  /**
   * PRESERVATION TEST 5: Sidebar shows legend indicators
   *
   * The sidebar should display legend items explaining the question states:
   * - "Soal aktif" (current question)
   * - "Sudah dijawab" (answered)
   * - "Belum dijawab" (not answered)
   */
  it("should display legend in sidebar for desktop viewport", async () => {
    // Arrange
    setupDesktopEnvironment(1440);

    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert: Legend items should be visible
    expect(screen.getByText("Soal aktif")).toBeInTheDocument();
    expect(screen.getByText("Sudah dijawab")).toBeInTheDocument();
    expect(screen.getByText("Belum dijawab")).toBeInTheDocument();
  });

  /**
   * PRESERVATION TEST 6: Sidebar prev/next buttons work correctly
   *
   * The sidebar contains its own Prev/Next navigation buttons.
   * These should work independently of the footer navigation.
   */
  it("should have working prev/next buttons in sidebar", async () => {
    // Arrange
    setupDesktopEnvironment(1440);

    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Assert initial state
    expect(screen.getByText(/Soal 1 dari 12/i)).toBeInTheDocument();

    // Find sidebar Next button (there are multiple, we want the one in sidebar)
    const nextButtons = screen.getAllByRole("button", { name: /Next →/i });
    // The sidebar Next button should exist
    expect(nextButtons.length).toBeGreaterThan(0);

    // Click Next in sidebar
    await act(async () => {
      fireEvent.click(nextButtons[0]);
    });

    // Should navigate to question 2
    expect(screen.getByText(/Soal 2 dari 12/i)).toBeInTheDocument();
  });

  /**
   * PROPERTY-BASED PRESERVATION TEST
   *
   * FOR ALL viewport WHERE viewport.width >= 1024px:
   *   sidebar.visible = true
   *   questionGrid.visible = true
   *
   * **Validates: Requirements 9.1, 9.2**
   *
   * Uses fast-check to generate random desktop viewport widths and verify
   * sidebar is always visible.
   */
  it("Property: FOR ALL viewports >= 1024px, sidebar should be visible with question grid", async () => {
    // Generate viewports from 1024px to 2560px (common desktop sizes)
    const desktopViewportArbitrary = fc.integer({ min: 1024, max: 2560 });

    await fc.assert(
      fc.asyncProperty(desktopViewportArbitrary, async (viewportWidth) => {
        // Arrange: Desktop viewport with varying width
        setupDesktopEnvironment(viewportWidth);

        // Clear any previous renders
        document.body.innerHTML = "";

        // Act
        const { unmount } = await act(async () => renderExamPage());

        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });

        // Assert: Sidebar elements should be visible
        const navHeader = screen.queryByText("Navigasi Soal");
        const button1 = screen.queryAllByRole("button", { name: "1" })[0];
        const legend = screen.queryByText("Soal aktif");

        // Cleanup
        unmount();

        // All sidebar elements should be present
        return navHeader !== null && button1 !== undefined && legend !== null;
      }),
      {
        numRuns: 10, // Reasonable number for preservation test
        verbose: true,
      },
    );
  });

  /**
   * PROPERTY-BASED PRESERVATION TEST
   *
   * FOR ALL questionIndex IN [0, totalQuestions-1]:
   *   clickNavButton(questionIndex) => currentQuestion = questionIndex
   *
   * **Validates: Requirement 9.2**
   *
   * Verifies navigation works correctly for any question selection.
   */
  it("Property: FOR ALL question indices, navigation should update current question", async () => {
    // Generate random question indices (0-11 for 12 questions)
    const questionIndexArbitrary = fc.integer({ min: 0, max: 11 });

    await fc.assert(
      fc.asyncProperty(questionIndexArbitrary, async (questionIndex) => {
        // Arrange
        setupDesktopEnvironment(1440);
        document.body.innerHTML = "";

        const { unmount } = await act(async () => renderExamPage());

        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });

        // Act: Click the question number button
        const questionNumber = questionIndex + 1;
        const buttons = screen.queryAllByRole("button", {
          name: String(questionNumber),
        });

        if (buttons.length === 0) {
          unmount();
          return false;
        }

        await act(async () => {
          fireEvent.click(buttons[0]);
        });

        // Assert: Should show the selected question
        const expectedText = `Soal ${questionNumber} dari 12`;
        const questionIndicator = screen.queryByText(
          new RegExp(expectedText, "i"),
        );

        // Cleanup
        unmount();

        return questionIndicator !== null;
      }),
      {
        numRuns: 12, // Test all 12 questions
        verbose: true,
      },
    );
  });

  /**
   * PRESERVATION TEST 7: Current question is highlighted in sidebar
   *
   * The active question button should have distinct styling (blue background).
   * We check for the presence of blue color indicators in the button's style.
   */
  it("should highlight current question button in sidebar", async () => {
    // Arrange
    setupDesktopEnvironment(1440);

    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Question 1 should be active initially - check for blue background
    const button1 = screen.getAllByRole("button", { name: "1" })[0];

    // Check the style attribute contains the active styling (blue background)
    const button1Style = button1.getAttribute("style") || "";
    expect(button1Style).toContain("rgb(37, 99, 235)"); // #2563eb in rgb

    // Navigate to question 5
    const button5 = screen.getAllByRole("button", { name: "5" })[0];
    await act(async () => {
      fireEvent.click(button5);
    });

    // Now button 5 should be active (blue background)
    const button5Style = button5.getAttribute("style") || "";
    expect(button5Style).toContain("rgb(37, 99, 235)");

    // Button 1 should no longer have blue background (it should be white)
    const button1UpdatedStyle = button1.getAttribute("style") || "";
    expect(button1UpdatedStyle).toContain("background: white");
  });

  /**
   * PRESERVATION TEST 8: Answered questions show green styling in sidebar
   *
   * When a question is answered, its button should show green styling.
   */
  it("should show green styling for answered questions in sidebar", async () => {
    // Arrange
    setupDesktopEnvironment(1440);

    await act(async () => {
      renderExamPage();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Find the option B button in the question area (not navigation buttons)
    // Option buttons have the format "B" followed by option text
    const optionButtons = screen.getAllByRole("button");
    // Find the button whose span child contains "B" as the option letter
    const optionB = optionButtons.find((btn) => {
      const spans = btn.querySelectorAll("span");
      return Array.from(spans).some((span) => span.textContent === "B");
    });

    expect(optionB).toBeDefined();

    await act(async () => {
      fireEvent.click(optionB!);
    });

    // Wait for state update
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Navigate to question 2
    const button2 = screen.getAllByRole("button", { name: "2" })[0];
    await act(async () => {
      fireEvent.click(button2);
    });

    // Now question 1's button should show answered styling (green border)
    const button1 = screen.getAllByRole("button", { name: "1" })[0];
    const button1Style = button1.getAttribute("style") || "";

    // Check for green border color (answered state)
    expect(button1Style).toContain("rgb(34, 197, 94)"); // #22c55e in rgb
  });
});

/**
 * Preservation Documentation:
 *
 * These tests capture the existing correct behavior of the desktop sidebar:
 *
 * 1. Desktop Sidebar Visibility (viewport >= 1024px):
 *    - Navigation sidebar displays as fixed right panel
 *    - Contains "Navigasi Soal" header
 *    - Contains 5-column grid of question number buttons
 *    - Contains legend explaining button states
 *
 * 2. Question Navigation:
 *    - Clicking any question number navigates to that question
 *    - Current question indicator updates ("Soal X dari Y")
 *    - Question content updates to show selected question
 *
 * 3. Visual Feedback:
 *    - Active question has blue background (#2563eb)
 *    - Answered questions have green styling (#22c55e border, #dcfce7 background)
 *    - Unanswered questions have neutral styling (white background, #e7e5e4 border)
 *
 * 4. Timer Display:
 *    - Timer visible in header area
 *    - Shows formatted time (MM:SS or HH:MM:SS)
 *
 * After the bugfix, all these behaviors MUST continue to work exactly the same.
 */
