import { useState, useCallback, useEffect } from "react";

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(
    () => !!document.fullscreenElement,
  );

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
    };
  }, []);

  const requestFullscreen = useCallback(async () => {
    if (!document.fullscreenEnabled) {
      // iOS Safari or unsupported browser — gracefully degrade
      console.warn(
        "[useFullscreen] Fullscreen API not supported. Skipping request.",
      );
      return false;
    }
    try {
      await document.documentElement.requestFullscreen();
      return true;
    } catch (err) {
      console.warn("[useFullscreen] Failed to enter fullscreen:", err);
      return false;
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) return false;
    try {
      await document.exitFullscreen();
      return true;
    } catch (err) {
      console.warn("[useFullscreen] Failed to exit fullscreen:", err);
      return false;
    }
  }, []);

  return { isFullscreen, requestFullscreen, exitFullscreen };
}
