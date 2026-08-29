/**
 * Device detection utilities for anti-cheat and responsive behavior.
 */

/**
 * Detects if the current device is a mobile/touch-primary device.
 *
 * Uses touch capability detection which reliably identifies:
 * - iOS Safari (which lacks Fullscreen API support)
 * - Android browsers
 * - Touch-enabled tablets
 *
 * Also considers narrow viewport width as a mobile indicator, since:
 * - Small browser windows should behave like mobile for UX
 * - Responsive breakpoint at 768px matches common tablet portrait width
 *
 * Handles SSR/Node.js environments where `navigator` and `window` are undefined.
 *
 * @returns true if device is mobile/touch-primary OR viewport is narrow
 */
export function isMobileDevice(): boolean {
  // Handle SSR/Node.js environment
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  // Touch capability detection
  const hasTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;

  // Narrow viewport detection (mobile breakpoint)
  const isNarrowViewport = window.innerWidth < 768;

  return hasTouch || isNarrowViewport;
}
