import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/services/api";

interface ResultData {
  sessionId: string;
  status: string;
  submittedAt: string;
  scoreCorrect: number;
  scoreTotal: number;
  scorePercentage: number;
  title?: string;
  subject?: string;
}

export default function ResultPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notReleased, setNotReleased] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    api
      .get(`/siswa/exam-sessions/${sessionId}/result`)
      .then((res) => setResult(res.data))
      .catch((err) => {
        if (err.response?.status === 403) setNotReleased(true);
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <div
          className="h-10 w-10 animate-spin rounded-full border-3 border-t-transparent"
          style={{
            borderColor: "var(--primary)",
            borderTopColor: "transparent",
          }}
        />
      </div>
    );
  }

  // ── Not released ──────────────────────────────────────────────────────────
  if (notReleased) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: "var(--bg)" }}
      >
        <div className="text-center max-w-sm">
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: "var(--blue-bg)", color: "var(--blue)" }}
          >
            <svg
              className="h-10 w-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </div>
          <h2
            className="text-xl font-semibold"
            style={{ color: "var(--text)" }}
          >
            Hasil Sedang Diproses
          </h2>
          <p
            className="mt-3 text-sm leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            Guru sedang memeriksa hasil ujian Anda. Silakan cek kembali nanti.
          </p>
          <button
            onClick={() => navigate("/exams")}
            className="btn-primary mt-8 w-full py-3.5 text-sm"
          >
            Kembali ke Daftar Ujian
          </button>
        </div>
      </div>
    );
  }

  // ── No result data (unexpected) ───────────────────────────────────────────
  if (!result) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: "var(--bg)" }}
      >
        <div className="text-center">
          <p className="text-sm" style={{ color: "var(--red)" }}>
            Hasil ujian tidak ditemukan.
          </p>
          <button
            onClick={() => navigate("/exams")}
            className="btn-primary mt-4 px-6 py-2.5 text-sm"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const scoreWrong = result.scoreTotal - result.scoreCorrect;
  const isPassing = result.scorePercentage >= 70;

  function formatSubmittedAt(dateStr: string): string {
    return new Date(dateStr).toLocaleString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ── Result ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10"
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <button
            onClick={() => navigate("/exams")}
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5 8.25 12l7.5-7.5"
              />
            </svg>
            Kembali
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        {/* Result Card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {/* Header with score */}
          <div
            className="px-6 py-8 text-center"
            style={{
              background: isPassing
                ? "linear-gradient(135deg, var(--emerald-bg) 0%, #d1fae5 100%)"
                : "linear-gradient(135deg, var(--amber-bg) 0%, #fef3c7 100%)",
            }}
          >
            {/* Trophy/Medal icon */}
            <div
              className="mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: isPassing ? "var(--emerald)" : "var(--amber)",
                color: "white",
                boxShadow: isPassing
                  ? "0 8px 24px rgba(16, 185, 129, 0.35)"
                  : "0 8px 24px rgba(245, 158, 11, 0.35)",
              }}
            >
              {isPassing ? (
                <svg
                  className="w-8 h-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-8 h-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                  />
                </svg>
              )}
            </div>

            {/* Score percentage */}
            <p
              className="text-5xl font-bold"
              style={{
                color: isPassing ? "var(--emerald-text)" : "var(--amber-text)",
              }}
            >
              {result.scorePercentage.toFixed(0)}
              <span className="text-2xl">%</span>
            </p>

            {/* Status text */}
            <p
              className="mt-2 text-sm font-medium"
              style={{
                color: isPassing ? "var(--emerald-text)" : "var(--amber-text)",
              }}
            >
              {isPassing ? "Selamat! Kamu lulus!" : "Tetap semangat!"}
            </p>

            {/* Exam title */}
            {(result.title || result.subject) && (
              <p
                className="mt-4 text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                {result.title || result.subject}
              </p>
            )}
          </div>

          {/* Stats section */}
          <div className="p-6">
            <div className="grid grid-cols-3 gap-3">
              {/* Benar */}
              <div
                className="rounded-xl p-4 text-center"
                style={{
                  background: "var(--emerald-bg)",
                  border: "1px solid var(--emerald-border)",
                }}
              >
                <p
                  className="text-2xl font-bold"
                  style={{ color: "var(--emerald)" }}
                >
                  {result.scoreCorrect}
                </p>
                <p
                  className="mt-1 text-xs font-medium"
                  style={{ color: "var(--emerald-text)" }}
                >
                  Benar
                </p>
              </div>

              {/* Salah */}
              <div
                className="rounded-xl p-4 text-center"
                style={{
                  background: "var(--red-bg)",
                  border: "1px solid var(--red-border)",
                }}
              >
                <p
                  className="text-2xl font-bold"
                  style={{ color: "var(--red)" }}
                >
                  {scoreWrong}
                </p>
                <p
                  className="mt-1 text-xs font-medium"
                  style={{ color: "var(--red-text)" }}
                >
                  Salah
                </p>
              </div>

              {/* Total */}
              <div
                className="rounded-xl p-4 text-center"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                <p
                  className="text-2xl font-bold"
                  style={{ color: "var(--text)" }}
                >
                  {result.scoreTotal}
                </p>
                <p
                  className="mt-1 text-xs font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  Total
                </p>
              </div>
            </div>

            {/* Submitted timestamp */}
            <div
              className="mt-6 pt-4 text-center"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <p className="text-xs" style={{ color: "var(--text-light)" }}>
                Dikumpulkan pada
              </p>
              <p
                className="mt-1 text-sm font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                {formatSubmittedAt(result.submittedAt)}
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 space-y-3">
          <button
            onClick={() => navigate("/exams")}
            className="btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
              />
            </svg>
            Kembali ke Beranda
          </button>
        </div>

        {/* Motivational message */}
        <div className="mt-8 text-center">
          <p className="text-xs" style={{ color: "var(--text-light)" }}>
            {isPassing
              ? "Pertahankan prestasi belajarmu! 🌟"
              : "Jangan menyerah, terus belajar dan coba lagi! 💪"}
          </p>
        </div>
      </main>
    </div>
  );
}
