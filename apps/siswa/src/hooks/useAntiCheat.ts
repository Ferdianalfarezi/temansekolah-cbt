import { useEffect, useRef, useState, useCallback } from "react";
import { ViolationType } from "@/common/enums";
import { isMobileDevice } from "@/lib/device";

export interface UseAntiCheatOptions {
  enabled: boolean;
  level: "standard" | "relaxed";
  initialViolationCount?: number;
  onViolation: (type: ViolationType, durationMs?: number) => void;
}

/**
 * Anti-cheat hook implementing browser-level restrictions during exams.
 *
 * Features:
 * - 16.1: Fullscreen monitoring + visibility/focus change detection
 * - 16.2: Keyboard shortcut blocking + right-click disabling
 * - 16.3: Violation reporting via the provided onViolation callback
 *
 * Graceful degradation:
 * - iOS Safari: fullscreen API unavailable → skipped, logged
 * - Mobile: keyboard shortcut blocking skipped (not applicable)
 */
export function useAntiCheat(options: UseAntiCheatOptions) {
  const { enabled, level, initialViolationCount = 0, onViolation } = options;

  const [violationCount, setViolationCount] = useState(initialViolationCount);
  const [isFullscreen, setIsFullscreen] = useState(
    () => !!document.fullscreenElement,
  );

  // Track visibility loss timestamps for duration calculation
  const hiddenAtRef = useRef<number | null>(null);
  const blurAtRef = useRef<number | null>(null);

  // Keep a stable reference to the callback to avoid re-binding listeners
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  const reportViolation = useCallback(
    (type: ViolationType, durationMs?: number) => {
      setViolationCount((c) => c + 1);
      onViolationRef.current(type, durationMs);
    },
    [],
  );

  // Request fullscreen on mount (standard mode only)
  const requestFullscreen = useCallback(async () => {
    if (!document.fullscreenEnabled) {
      console.warn(
        "[useAntiCheat] Fullscreen API not supported (iOS Safari?). Feature degraded.",
      );
      return;
    }
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.warn("[useAntiCheat] Failed to request fullscreen:", err);
    }
  }, []);

  // --- 16.1: Fullscreen and Visibility Monitoring ---
  useEffect(() => {
    if (!enabled) return;

    // Request fullscreen for standard mode only, skip on mobile devices
    // Mobile devices (iOS Safari, Android) often don't support Fullscreen API
    // and narrow viewports indicate mobile-like usage patterns
    const isMobile = isMobileDevice() || window.innerWidth < 768;
    if (level === "standard" && !isMobile) {
      requestFullscreen();
    }

    // Fullscreen change detection
    const handleFullscreenChange = () => {
      const inFullscreen = !!document.fullscreenElement;
      setIsFullscreen(inFullscreen);

      // If we were in fullscreen and user exited → violation
      if (!inFullscreen && level === "standard") {
        reportViolation(ViolationType.FULLSCREEN_EXIT);
      }
    };

    // Visibility change detection (tab switch)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else {
        const hiddenAt = hiddenAtRef.current;
        if (hiddenAt !== null) {
          const durationMs = Date.now() - hiddenAt;
          hiddenAtRef.current = null;
          reportViolation(ViolationType.TAB_SWITCH, durationMs);
        }
      }
    };

    // Window blur/focus detection (catches alt-tab without full tab switch)
    const handleBlur = () => {
      blurAtRef.current = Date.now();
    };

    const handleFocus = () => {
      const blurAt = blurAtRef.current;
      if (blurAt !== null) {
        const durationMs = Date.now() - blurAt;
        blurAtRef.current = null;
        reportViolation(ViolationType.FOCUS_LOSS, durationMs);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [enabled, level, reportViolation, requestFullscreen]);

  // --- 16.2: Keyboard/Right-Click Blocking ---
  useEffect(() => {
    if (!enabled) return;

    // Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Block specific keyboard shortcuts (desktop only)
    const handleKeydown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+C (copy)
      if (ctrl && e.key === "c") {
        e.preventDefault();
        return;
      }
      // Ctrl+V (paste)
      if (ctrl && e.key === "v") {
        e.preventDefault();
        return;
      }
      // Ctrl+P (print)
      if (ctrl && e.key === "p") {
        e.preventDefault();
        return;
      }
      // Ctrl+Shift+I (dev tools)
      if (ctrl && e.shiftKey && e.key === "I") {
        e.preventDefault();
        return;
      }
      // Ctrl+Shift+J (dev tools console)
      if (ctrl && e.shiftKey && e.key === "J") {
        e.preventDefault();
        return;
      }
      // F12 (dev tools)
      if (e.key === "F12") {
        e.preventDefault();
        return;
      }
      // PrintScreen
      if (e.key === "PrintScreen") {
        e.preventDefault();
        return;
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);

    // Skip keyboard blocking on mobile devices (not applicable)
    const mobile = isMobileDevice();
    if (mobile) {
      console.info(
        "[useAntiCheat] Mobile device detected — keyboard shortcut blocking skipped.",
      );
    } else {
      document.addEventListener("keydown", handleKeydown);
    }

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      if (!mobile) {
        document.removeEventListener("keydown", handleKeydown);
      }
    };
  }, [enabled]);

  return { violationCount, isFullscreen, requestFullscreen };
}
