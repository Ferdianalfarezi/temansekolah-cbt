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
        style={{ background: "#0f1117" }}
      >
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "#f59e0b", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  // ── Not released ──────────────────────────────────────────────────────────
  if (notReleased) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: "#0f1117" }}
      >
        <div className="text-center max-w-sm">
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "#1a1d27" }}
          >
            <svg
              className="h-8 w-8"
              style={{ color: "#64748b" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold" style={{ color: "#f8fafc" }}>
            Hasil Sedang Diproses
          </h2>
          <p className="mt-2 text-sm" style={{ color: "#64748b" }}>
            Guru sedang memeriksa hasil ujian Anda. Silakan cek kembali nanti.
          </p>
          <button
            onClick={() => navigate("/exams")}
            className="mt-8 w-full rounded-xl py-3 text-sm font-bold"
            style={{ background: "#f59e0b", color: "#0f1117" }}
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
        style={{ background: "#0f1117" }}
      >
        <div className="text-center">
          <p className="text-sm text-red-400">Hasil ujian tidak ditemukan.</p>
          <button
            onClick={() => navigate("/exams")}
            className="mt-4 rounded-xl px-5 py-2.5 text-sm font-bold"
            style={{ background: "#f59e0b", color: "#0f1117" }}
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const scoreWrong = result.scoreTotal - result.scoreCorrect;

  function formatSubmittedAt(dateStr: string): string {
    return new Date(dateStr).toLocaleString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ── Result ────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "#0f1117" }}
    >
      <div className="w-full max-w-sm">
        {/* Score display */}
        <div className="text-center mb-8">
          <p
            className="text-7xl font-bold"
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              color: "#f8fafc",
            }}
          >
            {result.scoreCorrect}
            <span className="text-4xl" style={{ color: "#94a3b8" }}>
              /{result.scoreTotal}
            </span>
          </p>

          {/* Percentage badge */}
          <div className="mt-4 flex justify-center">
            <span
              className="inline-block rounded-full px-4 py-1 text-lg font-bold"
              style={{ background: "#f59e0b", color: "#0f1117" }}
            >
              {result.scorePercentage.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {/* Benar */}
          <div
            className="rounded-xl p-4 text-center"
            style={{
              background: "rgba(16,185,129,0.10)",
              border: "1px solid rgba(16,185,129,0.20)",
            }}
          >
            <p className="text-2xl font-bold" style={{ color: "#34d399" }}>
              {result.scoreCorrect}
            </p>
            <p className="mt-1 text-xs" style={{ color: "#94a3b8" }}>
              Benar
            </p>
          </div>

          {/* Salah */}
          <div
            className="rounded-xl p-4 text-center"
            style={{
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.20)",
            }}
          >
            <p className="text-2xl font-bold" style={{ color: "#f87171" }}>
              {scoreWrong}
            </p>
            <p className="mt-1 text-xs" style={{ color: "#94a3b8" }}>
              Salah
            </p>
          </div>

          {/* Total */}
          <div
            className="rounded-xl p-4 text-center"
            style={{
              background: "#1a1d27",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <p className="text-2xl font-bold" style={{ color: "#f8fafc" }}>
              {result.scoreTotal}
            </p>
            <p className="mt-1 text-xs" style={{ color: "#94a3b8" }}>
              Total Soal
            </p>
          </div>
        </div>

        {/* Submitted at */}
        <p className="text-center text-xs mb-8" style={{ color: "#64748b" }}>
          Dikumpulkan: {formatSubmittedAt(result.submittedAt)}
        </p>

        {/* CTA */}
        <button
          onClick={() => navigate("/exams")}
          className="w-full rounded-xl py-3 text-sm font-bold"
          style={{ background: "#f59e0b", color: "#0f1117" }}
        >
          Kembali ke Daftar Ujian
        </button>
      </div>
    </div>
  );
}
