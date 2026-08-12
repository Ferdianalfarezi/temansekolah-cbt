import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const HEARTBEAT_INTERVAL_MS = 5_000;
const SNAPSHOT_INTERVAL_MS = 30_000;

export interface SavedAnswer {
  questionId: string;
  answer: string;
  savedAt: string;
}

export interface ExamSocketEvents {
  timer_paused: () => void;
  timer_resumed: () => void;
  timer_extended: (data: { additionalSeconds: number }) => void;
  force_submit: () => void;
  session_terminated: (data: { reason: string }) => void;
}

export function useExamSocket(sessionId: string, token: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [savedAnswers, setSavedAnswers] = useState<SavedAnswer[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const snapshotRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answersRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    // Skip if no token (not logged in)
    if (!token) {
      return;
    }

    // Determine WebSocket URL - use VITE_WS_URL or strip /api/v1 from API URL
    const env = (
      import.meta as unknown as {
        env?: { VITE_WS_URL?: string; VITE_API_URL?: string };
      }
    ).env;
    let wsUrl = env?.VITE_WS_URL ?? "";

    // Fallback: derive from API URL if WS URL not set
    if (!wsUrl && env?.VITE_API_URL) {
      // Remove /api/v1 suffix but keep https:// (Socket.IO handles protocol upgrade)
      wsUrl = env.VITE_API_URL.replace(/\/api\/v1$/, "");
    }

    // Don't proceed if no URL configured
    if (!wsUrl) {
      console.warn("WebSocket URL not configured");
      return;
    }

    console.log("[ExamSocket] Connecting to:", wsUrl);

    const socket = io(`${wsUrl}/exam`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[ExamSocket] Connected, joining session:", sessionId);
      setIsConnected(true);
      socket.emit("join_session", { sessionId });

      // Start heartbeat
      heartbeatRef.current = setInterval(() => {
        socket.emit("heartbeat", {
          sessionId,
          timestamp: new Date().toISOString(),
        });
      }, HEARTBEAT_INTERVAL_MS);

      // Start periodic answer snapshot
      snapshotRef.current = setInterval(() => {
        if (answersRef.current.size > 0) {
          const snapshot = Object.fromEntries(answersRef.current);
          socket.emit("answer_snapshot", {
            sessionId,
            answers: snapshot,
            timestamp: new Date().toISOString(),
          });
        }
      }, SNAPSHOT_INTERVAL_MS);
    });

    socket.on("connect_error", (error) => {
      console.error("[ExamSocket] Connection error:", error.message);
    });

    socket.on("error", (data) => {
      console.error("[ExamSocket] Server error:", data);
    });

    socket.on("disconnect", (reason) => {
      console.log("[ExamSocket] Disconnected:", reason);
      setIsConnected(false);
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (snapshotRef.current) {
        clearInterval(snapshotRef.current);
        snapshotRef.current = null;
      }
    });

    // Handle server acknowledgment of saved answers
    socket.on("answer_saved", (data: SavedAnswer) => {
      setSavedAnswers((prev) => {
        const filtered = prev.filter((a) => a.questionId !== data.questionId);
        return [...filtered, data];
      });
    });

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (snapshotRef.current) clearInterval(snapshotRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, token]);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback(
    <K extends keyof ExamSocketEvents>(
      event: K,
      handler: ExamSocketEvents[K],
    ) => {
      socketRef.current?.on(
        event as string,
        handler as (...args: unknown[]) => void,
      );
    },
    [],
  );

  const off = useCallback(
    <K extends keyof ExamSocketEvents>(
      event: K,
      handler?: ExamSocketEvents[K],
    ) => {
      socketRef.current?.off(
        event as string,
        handler as (...args: unknown[]) => void,
      );
    },
    [],
  );

  /**
   * Save a single answer via WebSocket.
   * Also stores locally for periodic snapshot emission.
   */
  const saveAnswer = useCallback(
    (questionId: string, answer: string) => {
      answersRef.current.set(questionId, answer);
      socketRef.current?.emit("answer_save", {
        sessionId,
        questionId,
        answer,
        timestamp: new Date().toISOString(),
      });
    },
    [sessionId],
  );

  return { isConnected, emit, on, off, savedAnswers, saveAnswer };
}
