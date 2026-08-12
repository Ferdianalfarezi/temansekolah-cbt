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

interface QuestionOption {
  key: string;
  text: string | null;
  imageUrl: string | null;
}

interface Question {
  id: string;
  nomor: number;
  teksSoal: string;
  gambarSoalUrl: string | null;
  options: QuestionOption[];
}

interface ExamData {
  sessionId: string;
  participantId: string;
  durationMinutes: number;
  remainingSeconds: number;
  totalQuestions: number;
  questions: Question[];
  savedAnswers?: Record<string, string>;
  namaUjian?: string;
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
        const data = res.data;
        setExamData(data);
        setTimeRemaining(data.remainingSeconds);

        const serverAnswers = new Map(Object.entries(data.savedAnswers || {}));
        const localAnswers = await getSessionAnswers(sessionId!);
        const merged = new Map([...serverAnswers, ...localAnswers]);
        setAnswers(merged);

        await cacheQuestions(sessionId!, data.questions);
      } catch (err: unknown) {
        const axiosErr = err as {
          response?: { status?: number; data?: { message?: string } };
        };
        if (axiosErr.response?.status === 401) {
          navigate("/");
          return;
        }
        setError(axiosErr.response?.data?.message || "Gagal memuat ujian.");
      } finally {
        setLoading(false);
      }
    }

    loadExam();
  }, [sessionId, navigate]);

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
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  function getTimerClass(): string {
    if (timeRemaining <= 60) return "danger";
    if (timeRemaining <= 300) return "warning";
    return "";
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "#f5f3ef" }}
      >
        <div className="text-center">
          <div
            className="h-10 w-10 mx-auto animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "#2563eb", borderTopColor: "transparent" }}
          />
          <p className="mt-4 text-sm" style={{ color: "#57534e" }}>
            Memuat ujian...
          </p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !examData) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: "#f5f3ef" }}
      >
        <div className="text-center max-w-sm">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "#fef2f2" }}
          >
            <svg
              className="h-8 w-8"
              style={{ color: "#ef4444" }}
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
          <h3 className="text-lg font-bold mb-2" style={{ color: "#1c1917" }}>
            Tidak Dapat Memuat Ujian
          </h3>
          <p className="text-sm mb-6" style={{ color: "#57534e" }}>
            {error || "Ujian tidak ditemukan atau Anda tidak memiliki akses."}
          </p>
          <button
            onClick={() => navigate("/exams")}
            className="rounded-lg px-6 py-2.5 text-sm font-bold"
            style={{ background: "#2563eb", color: "white" }}
          >
            Kembali ke Daftar Ujian
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = examData.questions[currentIndex];
  const totalQuestions = examData.questions.length;
  const answeredCount = answers.size;
  const unansweredCount = totalQuestions - answeredCount;
  const timerClass = getTimerClass();

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "#fafaf9" }}
    >
      {/* ── FULLSCREEN WARNING ──────────────────────────────────────────── */}
      {violationCount > 0 && (
        <div
          style={{
            background: "#fef3c7",
            borderBottom: "2px solid #fde68a",
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#92400e",
          }}
        >
          ⚠️ Pelanggaran terdeteksi ({violationCount}x). Aktivitas Anda
          dipantau.
        </div>
      )}

      {/* ── TOP BAR ────────────────────────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Left: subject info */}
        <div>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "white" }}>
            {examData.namaUjian || "Ujian"}
          </div>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
            {totalQuestions} Soal • Pilihan Ganda
          </div>
        </div>

        {/* Center: timer pill */}
        <div
          className={`timer ${timerClass}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background:
              timerClass === "danger"
                ? "rgba(239, 68, 68, 0.2)"
                : timerClass === "warning"
                  ? "rgba(251, 191, 36, 0.2)"
                  : "rgba(255,255,255,0.15)",
            padding: "8px 16px",
            borderRadius: "20px",
            border:
              timerClass === "danger"
                ? "1.5px solid rgba(239, 68, 68, 0.4)"
                : timerClass === "warning"
                  ? "1.5px solid rgba(251, 191, 36, 0.4)"
                  : "1.5px solid rgba(255,255,255,0.25)",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: "white" }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span
            style={{
              fontSize: "16px",
              fontWeight: 800,
              color:
                timerClass === "danger"
                  ? "#fecaca"
                  : timerClass === "warning"
                    ? "#fde68a"
                    : "white",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {isPaused ? "PAUSE" : formatTimer(timeRemaining)}
          </span>
        </div>

        {/* Right: save indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: "rgba(255,255,255,0.85)",
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background:
                saveStatus === "saved"
                  ? "#4ade80"
                  : saveStatus === "saving"
                    ? "#fbbf24"
                    : "#94a3b8",
              animation: saveStatus === "saved" ? "pulse 2s infinite" : "none",
            }}
          />
          {saveStatus === "saved"
            ? "Tersimpan"
            : saveStatus === "saving"
              ? "Menyimpan..."
              : "Offline"}
        </div>
      </header>

      {/* ── MAIN BODY ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Question panel */}
        <main style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          <div
            style={{
              background: "white",
              border: "2px solid #e7e5e4",
              borderRadius: "16px",
              padding: "28px",
              maxWidth: "720px",
              margin: "0 auto",
            }}
          >
            {/* Question number */}
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#2563eb",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: "12px",
              }}
            >
              Soal {currentIndex + 1} dari {totalQuestions}
            </div>

            {/* Question text */}
            <div
              style={{
                fontSize: "16px",
                fontWeight: 500,
                color: "#1c1917",
                lineHeight: 1.7,
                marginBottom: "24px",
              }}
            >
              <p>{currentQuestion.teksSoal}</p>
              {currentQuestion.gambarSoalUrl && (
                <img
                  src={currentQuestion.gambarSoalUrl}
                  alt="Gambar Soal"
                  style={{
                    marginTop: "16px",
                    maxWidth: "100%",
                    borderRadius: "12px",
                    maxHeight: "300px",
                  }}
                />
              )}
            </div>

            {/* Options */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {currentQuestion.options.map((option) => {
                const isSelected =
                  answers.get(currentQuestion.id) === option.key;

                return (
                  <button
                    key={option.key}
                    onClick={() => selectAnswer(currentQuestion.id, option.key)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "14px",
                      padding: "16px 18px",
                      border: isSelected
                        ? "2px solid #3b82f6"
                        : "2px solid #e7e5e4",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      background: isSelected ? "#eff6ff" : "white",
                      boxShadow: isSelected
                        ? "0 0 0 3px rgba(59, 130, 246, 0.1)"
                        : "none",
                      textAlign: "left",
                      width: "100%",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.borderColor = "#93c5fd";
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "#eff6ff";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.borderColor = "#e7e5e4";
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "white";
                      }
                    }}
                  >
                    {/* Letter badge */}
                    <span
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        fontWeight: 700,
                        border: isSelected ? "none" : "2px solid #e7e5e4",
                        flexShrink: 0,
                        background: isSelected ? "#2563eb" : "white",
                        color: isSelected ? "white" : "#1c1917",
                        transition: "all 0.15s",
                      }}
                    >
                      {option.key}
                    </span>
                    <div style={{ flex: 1, paddingTop: "4px" }}>
                      {option.text && (
                        <span style={{ fontSize: "15px", color: "#1c1917" }}>
                          {option.text}
                        </span>
                      )}
                      {option.imageUrl && (
                        <img
                          src={option.imageUrl}
                          alt={`Opsi ${option.key}`}
                          style={{
                            marginTop: "8px",
                            maxWidth: "100%",
                            borderRadius: "8px",
                            maxHeight: "150px",
                          }}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </main>

        {/* ── NAV SIDEBAR (Desktop) ─────────────────────────────────────── */}
        <aside
          className="hidden lg:flex"
          style={{
            width: "280px",
            background: "white",
            borderLeft: "2px solid #e7e5e4",
            padding: "20px",
            overflowY: "auto",
            flexDirection: "column",
          }}
        >
          <h4
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#57534e",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "16px",
            }}
          >
            Navigasi Soal
          </h4>

          {/* Question grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "8px",
            }}
          >
            {examData.questions.map((q, idx) => {
              const isAnswered = answers.has(q.id);
              const isCurrent = idx === currentIndex;

              let btnStyle: React.CSSProperties = {
                width: "40px",
                height: "40px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                border: "2px solid #e7e5e4",
                background: "white",
                color: "#1c1917",
                transition: "all 0.15s",
              };

              if (isCurrent) {
                btnStyle = {
                  ...btnStyle,
                  borderColor: "#2563eb",
                  background: "#2563eb",
                  color: "white",
                };
              } else if (isAnswered) {
                btnStyle = {
                  ...btnStyle,
                  borderColor: "#22c55e",
                  background: "#dcfce7",
                  color: "#15803d",
                };
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  style={btnStyle}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Prev/Next buttons in sidebar */}
          <div style={{ marginTop: "20px", display: "flex", gap: "8px" }}>
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "10px 20px",
                border: "2px solid #e7e5e4",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#57534e",
                background: "white",
                cursor: currentIndex === 0 ? "not-allowed" : "pointer",
                opacity: currentIndex === 0 ? 0.4 : 1,
              }}
            >
              ← Prev
            </button>
            <button
              onClick={() =>
                setCurrentIndex((i) => Math.min(totalQuestions - 1, i + 1))
              }
              disabled={currentIndex === totalQuestions - 1}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "10px 20px",
                border: "2px solid #e7e5e4",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#57534e",
                background: "white",
                cursor:
                  currentIndex === totalQuestions - 1
                    ? "not-allowed"
                    : "pointer",
                opacity: currentIndex === totalQuestions - 1 ? 0.4 : 1,
              }}
            >
              Next →
            </button>
          </div>

          {/* Legend */}
          <div
            style={{
              marginTop: "auto",
              paddingTop: "20px",
              borderTop: "1px solid #e7e5e4",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                color: "#57534e",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "3px",
                  border: "2px solid #2563eb",
                  background: "#2563eb",
                }}
              />
              Soal aktif
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                color: "#57534e",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "3px",
                  border: "2px solid #22c55e",
                  background: "#dcfce7",
                }}
              />
              Sudah dijawab
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                color: "#57534e",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "3px",
                  border: "2px solid #e7e5e4",
                  background: "white",
                }}
              />
              Belum dijawab
            </div>
          </div>
        </aside>

        {/* ── MOBILE NAV PANEL ──────────────────────────────────────────── */}
        {showNavPanel && (
          <>
            {/* Backdrop */}
            <div
              className="lg:hidden"
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                zIndex: 40,
              }}
              onClick={() => setShowNavPanel(false)}
            />

            {/* Panel */}
            <aside
              className="lg:hidden"
              style={{
                position: "fixed",
                right: 0,
                top: 0,
                bottom: 0,
                width: "280px",
                background: "white",
                borderLeft: "2px solid #e7e5e4",
                padding: "20px",
                overflowY: "auto",
                zIndex: 50,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                }}
              >
                <h4
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#57534e",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Navigasi Soal
                </h4>
                <button
                  onClick={() => setShowNavPanel(false)}
                  style={{
                    padding: "4px",
                    color: "#57534e",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Question grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: "8px",
                }}
              >
                {examData.questions.map((q, idx) => {
                  const isAnswered = answers.has(q.id);
                  const isCurrent = idx === currentIndex;

                  let btnStyle: React.CSSProperties = {
                    width: "40px",
                    height: "40px",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "2px solid #e7e5e4",
                    background: "white",
                    color: "#1c1917",
                  };

                  if (isCurrent) {
                    btnStyle = {
                      ...btnStyle,
                      borderColor: "#2563eb",
                      background: "#2563eb",
                      color: "white",
                    };
                  } else if (isAnswered) {
                    btnStyle = {
                      ...btnStyle,
                      borderColor: "#22c55e",
                      background: "#dcfce7",
                      color: "#15803d",
                    };
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setShowNavPanel(false);
                      }}
                      style={btnStyle}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Stats */}
              <p
                style={{
                  marginTop: "16px",
                  fontSize: "13px",
                  color: "#57534e",
                }}
              >
                Dijawab: {answeredCount} | Belum: {unansweredCount}
              </p>
            </aside>
          </>
        )}
      </div>

      {/* ── BOTTOM NAV ───────────────────────────────────────────────────── */}
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          background: "white",
          borderTop: "2px solid #e7e5e4",
        }}
      >
        {/* Prev button */}
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 20px",
            border: "2px solid #e7e5e4",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#57534e",
            background: "white",
            cursor: currentIndex === 0 ? "not-allowed" : "pointer",
            opacity: currentIndex === 0 ? 0.4 : 1,
          }}
        >
          ← Sebelumnya
        </button>

        {/* Mobile nav toggle */}
        <button
          className="lg:hidden"
          onClick={() => setShowNavPanel(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "8px 12px",
            border: "2px solid #e7e5e4",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#57534e",
            background: "white",
            cursor: "pointer",
          }}
        >
          📋 {currentIndex + 1}/{totalQuestions}
        </button>

        {/* Desktop counter */}
        <span
          className="hidden lg:block"
          style={{ fontSize: "14px", fontWeight: 600, color: "#57534e" }}
        >
          {currentIndex + 1} / {totalQuestions}
        </span>

        {/* Right: Next + Submit */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() =>
              setCurrentIndex((i) => Math.min(totalQuestions - 1, i + 1))
            }
            disabled={currentIndex === totalQuestions - 1}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 20px",
              border: "2px solid #e7e5e4",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#57534e",
              background: "white",
              cursor:
                currentIndex === totalQuestions - 1 ? "not-allowed" : "pointer",
              opacity: currentIndex === totalQuestions - 1 ? 0.4 : 1,
            }}
          >
            Selanjutnya →
          </button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            style={{
              padding: "10px 24px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
              opacity: submitting ? 0.5 : 1,
            }}
          >
            {submitting ? "Mengirim..." : "Kumpulkan"}
          </button>
        </div>
      </footer>

      {/* ── SUBMIT MODAL ─────────────────────────────────────────────────── */}
      {showSubmitModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            background: "rgba(0,0,0,0.5)",
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "400px",
              background: "white",
              borderRadius: "16px",
              padding: "32px",
              border: "2px solid #e7e5e4",
            }}
          >
            {/* Warning icon */}
            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <div
                style={{
                  margin: "0 auto 16px",
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "#fef3c7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#d97706"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#1c1917",
                  marginBottom: "8px",
                }}
              >
                Konfirmasi Kumpulkan
              </h3>
              <p style={{ fontSize: "14px", color: "#57534e" }}>
                Masih ada{" "}
                <span style={{ fontWeight: 700, color: "#dc2626" }}>
                  {unansweredCount} soal
                </span>{" "}
                yang belum dijawab. Yakin ingin mengumpulkan?
              </p>
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowSubmitModal(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  border: "2px solid #e7e5e4",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#57534e",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Kembali
              </button>
              <button
                onClick={() => handleSubmit(true)}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                {submitting ? "Mengirim..." : "Kumpulkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyframe animation for save indicator */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
