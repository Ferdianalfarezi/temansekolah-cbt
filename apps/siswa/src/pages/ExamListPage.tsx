import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/services/api";

interface ExamSession {
  id: string;
  title: string;
  subject: string;
  duration: number; // minutes
  questionCount: number;
  status: "packaged" | "active" | "completed";
  startTime?: string;
  endTime?: string;
}

const STATUS_CONFIG = {
  packaged: {
    label: "Akan Datang",
    badgeStyle: { background: "rgba(99,102,241,0.15)", color: "#818cf8" },
    borderStyle: { borderLeft: "3px solid #6366f1" },
  },
  active: {
    label: "Siap Dikerjakan",
    badgeStyle: { background: "rgba(245,158,11,0.15)", color: "#f59e0b" },
    borderStyle: { borderLeft: "3px solid var(--amber)" },
  },
  completed: {
    label: "Selesai",
    badgeStyle: { background: "rgba(16,185,129,0.15)", color: "#10b981" },
    borderStyle: { borderLeft: "3px solid var(--emerald)" },
  },
} as const;

export default function ExamListPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const user = JSON.parse(localStorage.getItem("cbt_user") || "{}");

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    try {
      const res = await api.get("/siswa/exam-sessions");
      setSessions(res.data.sessions || res.data);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      if (axiosErr.response?.status === 401) return;
      setError(
        axiosErr.response?.data?.message || "Gagal memuat daftar ujian.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("cbt_token");
    localStorage.removeItem("cbt_user");
    navigate("/");
  }

  function handleStartExam(session: ExamSession) {
    if (session.status === "active") {
      navigate(`/exam/${session.id}`);
    }
  }

  function formatDuration(minutes: number): string {
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m > 0 ? `${h} jam ${m} menit` : `${h} jam`;
    }
    return `${minutes} menit`;
  }

  function formatTime(dateStr?: string): string {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 px-4 py-3"
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="mx-auto max-w-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo mark */}
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: "var(--amber-glow)" }}
            >
              <svg
                className="h-4 w-4"
                style={{ color: "var(--amber)" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text)" }}
              >
                {user.name || "Siswa"}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Daftar Ujian
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-colors"
            style={{ color: "var(--text-muted)" }}
            title="Keluar"
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
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Keluar
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-lg px-4 py-6">
        {loading && (
          <div className="flex justify-center py-16">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{
                borderColor: "var(--amber)",
                borderTopColor: "transparent",
              }}
            />
          </div>
        )}

        {error && (
          <div
            className="mb-4 rounded-lg px-4 py-3 text-sm"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#fca5a5",
            }}
          >
            {error}
            <button
              onClick={() => {
                setError("");
                setLoading(true);
                fetchSessions();
              }}
              className="ml-2 font-medium underline"
            >
              Coba lagi
            </button>
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="text-center py-16">
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "var(--surface)" }}
            >
              <svg
                className="h-8 w-8"
                style={{ color: "var(--text-muted)" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Belum ada ujian yang tersedia.
            </p>
            <p
              className="mt-1 text-xs"
              style={{ color: "var(--text-muted)", opacity: 0.6 }}
            >
              Ujian akan muncul di sini saat sudah dijadwalkan.
            </p>
          </div>
        )}

        {/* Session Cards */}
        <div className="space-y-3">
          {sessions.map((session) => {
            const config = STATUS_CONFIG[session.status];
            return (
              <div
                key={session.id}
                className="rounded-xl p-4 transition-all"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  ...config.borderStyle,
                  cursor: session.status === "active" ? "pointer" : "default",
                }}
                onClick={() => handleStartExam(session)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-semibold truncate text-sm"
                      style={{ color: "var(--text)" }}
                    >
                      {session.title}
                    </h3>
                    <p
                      className="mt-0.5 text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {session.subject}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={config.badgeStyle}
                  >
                    {config.label}
                  </span>
                </div>

                <div
                  className="mt-3 flex items-center gap-4 text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span className="flex items-center gap-1">
                    <svg
                      className="h-3.5 w-3.5"
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
                    {formatDuration(session.duration)}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {session.questionCount} soal
                  </span>
                  {session.startTime && (
                    <span className="flex items-center gap-1">
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {formatTime(session.startTime)}
                    </span>
                  )}
                </div>

                {session.status === "active" && (
                  <div className="mt-4">
                    <button
                      className="w-full min-h-[48px] rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                      style={{ background: "var(--amber)", color: "#0f1117" }}
                    >
                      Mulai Ujian →
                    </button>
                  </div>
                )}

                {session.status === "completed" && (
                  <div className="mt-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/result/${session.id}`);
                      }}
                      className="w-full min-h-[48px] rounded-lg text-sm font-medium transition-colors"
                      style={{
                        border: "1px solid var(--emerald)",
                        color: "var(--emerald)",
                        background: "transparent",
                      }}
                    >
                      Lihat Hasil
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
