import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAntiCheat, useExamSocket } from "@/hooks";
import { ViolationType } from "@cbt/shared";
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

  // Current state
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

  // WebSocket connection
  const {
    isConnected,
    on,
    off,
    saveAnswer: socketSaveAnswer,
  } = useExamSocket(sessionId || "", token);

  // Anti-cheat
  const { violationCount } = useAntiCheat({
    enabled: !!examData,
    level: "standard",
    onViolation: (type: ViolationType, durationMs?: number) => {
      // Report violation to server
      api
        .post(`/siswa/exam-sessions/${sessionId}/violations`, {
          type,
          durationMs,
          timestamp: new Date().toISOString(),
        })
        .catch(() => {
          /* silent */
        });
    },
  });

  // Fetch exam data
  useEffect(() => {
    if (!sessionId) return;

    async function loadExam() {
      try {
        const res = await api.get(`/siswa/exam-sessions/${sessionId}/start`);
        const data: ExamData = res.data;
        setExamData(data);
        setTimeRemaining(data.remainingSeconds);

        // Load saved answers (from server response + local cache)
        const serverAnswers = new Map(Object.entries(data.answers || {}));
        const localAnswers = await getSessionAnswers(sessionId!);

        // Merge: local answers take precedence (they're more recent)
        const merged = new Map([...serverAnswers, ...localAnswers]);
        setAnswers(merged);

        // Cache questions locally for offline access
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

  // Sync unsynced answers on reconnect
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

  // Timer countdown
  useEffect(() => {
    if (!examData || isPaused) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Time's up — auto-submit
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

  // Socket event handlers
  useEffect(() => {
    const handlePaused = () => setIsPaused(true);
    const handleResumed = () => setIsPaused(false);
    const handleExtended = (data: { additionalSeconds: number }) => {
      setTimeRemaining((prev) => prev + data.additionalSeconds);
    };
    const handleForceSubmit = () => handleSubmit(true);
    const handleTerminated = () => {
      navigate(`/result/${sessionId}`);
    };

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

  // Mark answer as synced when server confirms
  useEffect(() => {
    if (!isConnected) {
      setSaveStatus("offline");
    } else {
      setSaveStatus("saved");
    }
  }, [isConnected]);

  // Select answer
  const selectAnswer = useCallback(
    async (questionId: string, answer: string) => {
      setAnswers((prev) => {
        const next = new Map(prev);
        next.set(questionId, answer);
        return next;
      });

      setSaveStatus("saving");

      // Save locally first (offline-first)
      await saveAnswerLocally(sessionId!, questionId, answer);

      // Then sync via WebSocket if connected
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

  // Submit exam
  const handleSubmit = useCallback(
    async (force = false) => {
      if (submitting) return;

      // Check for unanswered questions (only if not force)
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
        // If submission fails, keep retrying
        setSubmitting(false);
        setError("Gagal mengirim jawaban. Coba lagi.");
      }
    },
    [submitting, examData, answers, sessionId, navigate],
  );

  // Format timer display
  function formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="mt-3 text-sm text-gray-500">Memuat ujian...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !examData) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => navigate("/exams")}
            className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm text-white"
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
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Top Bar — Blue Gradient */}
      <header className="bg-linear-to-r from-blue-700 to-blue-600 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Timer */}
            <div
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${
                timeRemaining <= 300
                  ? "bg-red-500/20 animate-pulse"
                  : "bg-white/10"
              }`}
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-mono text-sm font-bold">
                {isPaused ? "PAUSE" : formatTimer(timeRemaining)}
              </span>
            </div>

            {/* Save indicator */}
            <div className="flex items-center gap-1 text-xs opacity-75">
              {saveStatus === "saving" && (
                <>
                  <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-300" />
                  <span>Menyimpan</span>
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <div className="h-2 w-2 rounded-full bg-green-300" />
                  <span>Tersimpan</span>
                </>
              )}
              {saveStatus === "offline" && (
                <>
                  <div className="h-2 w-2 rounded-full bg-orange-300" />
                  <span>Offline</span>
                </>
              )}
            </div>
          </div>

          {/* Question counter + nav toggle */}
          <button
            onClick={() => setShowNavPanel(!showNavPanel)}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm"
          >
            <span>
              {currentIndex + 1}/{totalQuestions}
            </span>
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
                d="M4 6h16M4 12h16m-7 6h7"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Violation warning */}
      {violationCount > 0 && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-700 text-center">
          ⚠️ Pelanggaran terdeteksi ({violationCount}x). Aktivitas Anda
          dipantau.
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Question Panel */}
        <main className="flex-1 px-4 py-6">
          <div className="mx-auto max-w-2xl">
            {/* Question number */}
            <div className="mb-4">
              <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                Soal {currentIndex + 1}
              </span>
            </div>

            {/* Question text */}
            <div className="mb-6">
              <p className="text-base leading-relaxed text-gray-900">
                {currentQuestion.questionText}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion.options.map((option, idx) => {
                const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D, E
                const isSelected =
                  answers.get(currentQuestion.id) === optionLetter;

                return (
                  <button
                    key={idx}
                    onClick={() =>
                      selectAnswer(currentQuestion.id, optionLetter)
                    }
                    className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {optionLetter}
                      </span>
                      <span className="text-sm leading-relaxed text-gray-800 pt-0.5">
                        {option}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </main>

        {/* Navigation Sidebar (mobile: overlay, desktop: side panel) */}
        {showNavPanel && (
          <>
            {/* Backdrop on mobile */}
            <div
              className="fixed inset-0 bg-black/30 z-40 lg:hidden"
              onClick={() => setShowNavPanel(false)}
            />
            <aside className="fixed right-0 top-0 bottom-0 z-50 w-72 bg-white shadow-xl p-4 overflow-y-auto lg:relative lg:w-64 lg:shadow-none lg:border-l lg:border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 text-sm">
                  Navigasi Soal
                </h3>
                <button
                  onClick={() => setShowNavPanel(false)}
                  className="text-gray-400 hover:text-gray-600 lg:hidden"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 mb-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded bg-green-500" /> Dijawab
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded bg-gray-300" /> Belum
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded bg-blue-500" /> Saat ini
                </span>
              </div>

              {/* Question Grid */}
              <div className="grid grid-cols-5 gap-2">
                {examData.questions.map((q, idx) => {
                  const isAnswered = answers.has(q.id);
                  const isCurrent = idx === currentIndex;

                  let bgClass = "bg-gray-200 text-gray-700"; // unanswered
                  if (isCurrent) bgClass = "bg-blue-600 text-white";
                  else if (isAnswered) bgClass = "bg-green-500 text-white";

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setShowNavPanel(false);
                      }}
                      className={`h-9 w-full rounded-lg text-xs font-bold ${bgClass} hover:opacity-80 transition-opacity`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Dijawab: {answeredCount}</span>
                  <span>Belum: {unansweredCount}</span>
                </div>
              </div>

              {/* Submit button in nav panel */}
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="mt-4 w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Selesai & Kirim
              </button>
            </aside>
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <footer className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
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

          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? "Mengirim..." : "Selesai"}
          </button>

          <button
            onClick={() =>
              setCurrentIndex((i) => Math.min(totalQuestions - 1, i + 1))
            }
            disabled={currentIndex === totalQuestions - 1}
            className="flex items-center gap-1 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
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

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                <svg
                  className="h-6 w-6 text-yellow-600"
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
              <h3 className="text-lg font-bold text-gray-900">
                Konfirmasi Kirim
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Anda masih memiliki{" "}
                <span className="font-bold text-red-600">
                  {unansweredCount} soal
                </span>{" "}
                yang belum dijawab. Yakin ingin mengirim jawaban?
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Kembali
              </button>
              <button
                onClick={() => handleSubmit(true)}
                disabled={submitting}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? "Mengirim..." : "Kirim Sekarang"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
