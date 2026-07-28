import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAntiCheat, useExamSocket } from "@/hooks";
import { ViolationType } from "@/common/enums";
import api from "@/services/api";
import {
  saveAnswerLocally,
  markAnswerSynced,
  getSessionAnswers,
  getUnsyncedAnswers,
  cacheQuestions,
  clearSessionCache,
} from "@/services/examCache";

interface Question {
  id: string;
  questionText: string;
  options: string[]; // ["A. ...", "B. ...", ...]
  orderIndex: number;
}

interface ExamData {
  sessionId: string;
  title: string;
  subject: string;
  duration: number; // total seconds
  remainingSeconds: number;
  questions: Question[];
  answers: Record<string, string>; // questionId -> answer
}

export default function ExamPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [examData, setExamData] = useState<ExamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showNavPanel, setShowNavPanel] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "offline">(
    "saved",
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const token = localStorage.getItem("cbt_token") || "";

  const {
    isConnected,
    on,
    off,
    saveAnswer: socketSaveAnswer,
  } = useExamSocket(sessionId || "", token);

  const { violationCount } = useAntiCheat({
    enabled: !!examData,
    level: "standard",
    onViolation: (type: ViolationType, durationMs?: number) => {
      api
        .post(`/siswa/exam-sessions/${sessionId}/violations`, {
          type,
          durationMs,
          timestamp: new Date().toISOString(),
        })
        .catch(() => {});
    },
  });

  // ── Load exam ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    async function loadExam() {
      try {
        const res = await api.get(`/siswa/exam-sessions/${sessionId}/start`);
        const data: ExamData = res.data;
        setExamData(data);
        setTimeRemaining(data.remainingSeconds);

        const serverAnswers = new Map(Object.entries(data.answers || {}));
        const localAnswers = await getSessionAnswers(sessionId!);
        const merged = new Map([...serverAnswers, ...localAnswers]);
        setAnswers(merged);

        await cacheQuestions(sessionId!, data.questions);
      } catch (err: unknown) {
        const axiosErr = err as {
          response?: { status?: number; data?: { message?: string } };
        };
        if (axiosErr.response?.status === 401) return;
        setError(axiosErr.response?.data?.message || "Gagal memuat ujian.");
      } finally {
        setLoading(false);
      }
    }

    loadExam();
  }, [sessionId]);

  // ── Sync unsynced answers on reconnect ────────────────────────────────────
  useEffect(() => {
    if (!isConnected || !sessionId) return;

    async function syncAnswers() {
      const unsynced = await getUnsyncedAnswers(sessionId!);
      for (const record of unsynced) {
        socketSaveAnswer(record.questionId, record.answer);
      }
    }

    syncAnswers();
  }, [isConnected, sessionId, socketSaveAnswer]);

  // ── Timer countdown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!examData || isPaused) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [examData, isPaused]);

  // ── Socket event handlers ─────────────────────────────────────────────────
  useEffect(() => {
    const handlePaused = () => setIsPaused(true);
    const handleResumed = () => setIsPaused(false);
    const handleExtended = (data: { additionalSeconds: number }) => {
      setTimeRemaining((prev) => prev + data.additionalSeconds);
    };
    const handleForceSubmit = () => handleSubmit(true);
    const handleTerminated = () => navigate(`/result/${sessionId}`);

    on("timer_paused", handlePaused);
    on("timer_resumed", handleResumed);
    on("timer_extended", handleExtended);
    on("force_submit", handleForceSubmit);
    on("session_terminated", handleTerminated);

    return () => {
      off("timer_paused", handlePaused);
      off("timer_resumed", handleResumed);
      off("timer_extended", handleExtended);
      off("force_submit", handleForceSubmit);
      off("session_terminated", handleTerminated);
    };
  }, [on, off, sessionId, navigate]);

  // ── Connectivity indicator ────────────────────────────────────────────────
  useEffect(() => {
    setSaveStatus(isConnected ? "saved" : "offline");
  }, [isConnected]);

  // ── Select answer ─────────────────────────────────────────────────────────
  const selectAnswer = useCallback(
    async (questionId: string, answer: string) => {
      setAnswers((prev) => {
        const next = new Map(prev);
        next.set(questionId, answer);
        return next;
      });

      setSaveStatus("saving");
      await saveAnswerLocally(sessionId!, questionId, answer);

      if (isConnected) {
        socketSaveAnswer(questionId, answer);
        await markAnswerSynced(sessionId!, questionId);
        setSaveStatus("saved");
      } else {
        setSaveStatus("offline");
      }
    },
    [sessionId, isConnected, socketSaveAnswer],
  );

  // ── Submit exam ───────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (force = false) => {
      if (submitting) return;

      if (!force && examData) {
        const unanswered = examData.questions.filter((q) => !answers.has(q.id));
        if (unanswered.length > 0) {
          setShowSubmitModal(true);
          return;
        }
      }

      setSubmitting(true);
      setShowSubmitModal(false);

      try {
        const answerObj = Object.fromEntries(answers);
        await api.post(`/siswa/exam-sessions/${sessionId}/submit`, {
          answers: answerObj,
        });
        await clearSessionCache(sessionId!);
        navigate(`/result/${sessionId}`);
      } catch {
        setSubmitting(false);
        setError("Gagal mengirim jawaban. Coba lagi.");
      }
    },
    [submitting, examData, answers, sessionId, navigate],
  );

  function formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "#0f1117" }}
      >
        <div className="text-center">
          <div
            className="h-10 w-10 mx-auto animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "#f59e0b", borderTopColor: "transparent" }}
          />
          <p className="mt-4 text-sm" style={{ color: "#94a3b8" }}>
            Memuat ujian...
          </p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error && !examData) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: "#0f1117" }}
      >
        <div className="text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => navigate("/exams")}
            className="mt-4 rounded-xl px-5 py-2.5 text-sm font-bold"
            style={{ background: "#f59e0b", color: "#0f1117" }}
          >
            Kembali ke Daftar Ujian
          </button>
        </div>
      </div>
    );
  }

  if (!examData) return null;

  const currentQuestion = examData.questions[currentIndex];
  const totalQuestions = examData.questions.length;
  const answeredCount = answers.size;
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "#0f1117" }}
    >
      {/* ── TOP BAR ────────────────────────────────────────────────────────── */}
      <header
        className="h-12 flex items-center px-4 shrink-0"
        style={{
          background: "#1a1d27",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Left: subject */}
        <div className="flex-1 min-w-0">
          <span className="text-sm truncate" style={{ color: "#94a3b8" }}>
            {examData.subject}
          </span>
        </div>

        {/* Center: timer pill */}
        <div className="flex-1 flex justify-center">
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1 ${
              timeRemaining < 300 ? "animate-pulse" : ""
            }`}
            style={{
              background: "rgba(245,158,11,0.10)",
              border: "1px solid rgba(245,158,11,0.30)",
            }}
          >
            {/* Clock icon */}
            <svg
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: "#f59e0b" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                color: "#f59e0b",
                fontSize: "0.8125rem",
                fontWeight: 700,
              }}
            >
              {isPaused ? "PAUSE" : formatTimer(timeRemaining)}
            </span>
          </div>
        </div>

        {/* Right: Q counter + nav toggle */}
        <div className="flex-1 flex justify-end items-center gap-3">
          <span className="text-sm" style={{ color: "#94a3b8" }}>
            Q: {currentIndex + 1}/{totalQuestions}
          </span>
          <button
            onClick={() => setShowNavPanel(!showNavPanel)}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: "#94a3b8" }}
            aria-label="Navigasi soal"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16m-7 6h7"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* ── VIOLATION BAR ─────────────────────────────────────────────────── */}
      {violationCount > 0 && (
        <div
          className="px-4 py-2 text-center text-xs font-medium"
          style={{
            background: "rgba(120,53,15,0.5)",
            color: "#fbbf24",
            borderBottom: "1px solid rgba(245,158,11,0.2)",
          }}
        >
          ⚠️ Pelanggaran terdeteksi ({violationCount}x). Aktivitas Anda
          dipantau.
        </div>
      )}

      {/* ── MAIN AREA ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Question panel */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-2xl">
            {/* Question number label */}
            <p
              className="mb-3 text-xs font-semibold uppercase"
              style={{
                color: "#f59e0b",
                letterSpacing: "0.1em",
              }}
            >
              SOAL {String(currentIndex + 1).padStart(2, "0")}
            </p>

            {/* Question text */}
            <p
              className="mb-8 text-xl leading-relaxed"
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                color: "#f8fafc",
              }}
            >
              {currentQuestion.questionText}
            </p>

            {/* Options */}
            <div className="flex flex-col gap-3">
              {currentQuestion.options.map((option, idx) => {
                const optionLetter = String.fromCharCode(65 + idx);
                const isSelected =
                  answers.get(currentQuestion.id) === optionLetter;

                return (
                  <button
                    key={idx}
                    onClick={() =>
                      selectAnswer(currentQuestion.id, optionLetter)
                    }
                    className="w-full text-left rounded-xl px-5 py-4 transition-all"
                    style={
                      isSelected
                        ? {
                            background: "rgba(245,158,11,0.08)",
                            borderTop: "1px solid rgba(245,158,11,0.20)",
                            borderRight: "1px solid rgba(245,158,11,0.20)",
                            borderBottom: "1px solid rgba(245,158,11,0.20)",
                            borderLeft: "4px solid #f59e0b",
                          }
                        : {
                            background: "#1a1d27",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "#22263a";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "#1a1d27";
                    }}
                  >
                    <div className="flex items-start gap-4">
                      {/* Letter badge */}
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                        style={
                          isSelected
                            ? { background: "#f59e0b", color: "#0f1117" }
                            : { background: "#22263a", color: "#94a3b8" }
                        }
                      >
                        {optionLetter}
                      </span>
                      <span
                        className="text-sm leading-relaxed pt-0.5"
                        style={{ color: "#e2e8f0" }}
                      >
                        {option}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </main>

        {/* ── NAV SIDEBAR ───────────────────────────────────────────────── */}
        {showNavPanel && (
          <>
            {/* Mobile backdrop */}
            <div
              className="fixed inset-0 z-40 lg:hidden"
              style={{ background: "rgba(0,0,0,0.6)" }}
              onClick={() => setShowNavPanel(false)}
            />

            <aside
              className="fixed right-0 top-0 bottom-0 z-50 w-64 overflow-y-auto p-4 lg:relative lg:shrink-0"
              style={{
                background: "#1a1d27",
                borderLeft: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <p
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#64748b" }}
                >
                  NAVIGASI SOAL
                </p>
                <button
                  onClick={() => setShowNavPanel(false)}
                  className="lg:hidden rounded p-1"
                  style={{ color: "#64748b" }}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Question grid */}
              <div className="grid grid-cols-5 gap-2">
                {examData.questions.map((q, idx) => {
                  const isAnswered = answers.has(q.id);
                  const isCurrent = idx === currentIndex;

                  let btnStyle: React.CSSProperties = {
                    background: "#22263a",
                    color: "#94a3b8",
                    border: "1px solid transparent",
                  };
                  if (isCurrent) {
                    btnStyle = {
                      background: "#f59e0b",
                      color: "#0f1117",
                      border: "1px solid transparent",
                    };
                  } else if (isAnswered) {
                    btnStyle = {
                      background: "rgba(16,185,129,0.20)",
                      color: "#34d399",
                      border: "1px solid rgba(16,185,129,0.30)",
                    };
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setShowNavPanel(false);
                      }}
                      className="h-10 w-full rounded-lg text-xs font-bold transition-opacity hover:opacity-80"
                      style={btnStyle}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Stats */}
              <p className="mt-4 text-xs" style={{ color: "#64748b" }}>
                Dijawab: {answeredCount} | Belum: {unansweredCount}
              </p>

              {/* Submit button */}
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="mt-3 w-full rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
                style={{ background: "#f59e0b", color: "#0f1117" }}
              >
                {submitting ? "Mengirim..." : "Kumpulkan"}
              </button>
            </aside>
          </>
        )}
      </div>

      {/* ── BOTTOM BAR ───────────────────────────────────────────────────── */}
      <footer
        className="h-14 flex items-center px-4 shrink-0"
        style={{
          background: "#1a1d27",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="mx-auto w-full max-w-2xl flex items-center justify-between">
          {/* Prev */}
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: "#cbd5e1" }}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Sebelumnya
          </button>

          {/* Submit */}
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="rounded-xl px-6 py-2 text-sm font-bold disabled:opacity-50"
            style={{ background: "#f59e0b", color: "#0f1117" }}
          >
            {submitting ? "Mengirim..." : "KUMPULKAN"}
          </button>

          {/* Next */}
          <button
            onClick={() =>
              setCurrentIndex((i) => Math.min(totalQuestions - 1, i + 1))
            }
            disabled={currentIndex === totalQuestions - 1}
            className="flex items-center gap-1.5 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: "#cbd5e1" }}
          >
            Selanjutnya
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </footer>

      {/* ── SUBMIT MODAL ─────────────────────────────────────────────────── */}
      {showSubmitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.70)" }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{
              background: "#1a1d27",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            {/* Warning icon */}
            <div className="text-center mb-4">
              <div
                className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: "rgba(245,158,11,0.15)" }}
              >
                <svg
                  className="h-6 w-6"
                  style={{ color: "#f59e0b" }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold" style={{ color: "#f8fafc" }}>
                Konfirmasi Kumpulkan
              </h3>
              <p className="mt-2 text-sm" style={{ color: "#94a3b8" }}>
                Masih ada{" "}
                <span className="font-bold text-red-400">
                  {unansweredCount} soal
                </span>{" "}
                yang belum dijawab. Yakin ingin mengumpulkan?
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                style={{
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#94a3b8",
                  background: "transparent",
                }}
              >
                Kembali
              </button>
              <button
                onClick={() => handleSubmit(true)}
                disabled={submitting}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
                style={{ background: "#f59e0b", color: "#0f1117" }}
              >
                {submitting ? "Mengirim..." : "Kumpulkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
