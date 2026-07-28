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
    badgeClass: "bg-yellow-100 text-yellow-800",
    cardBorder: "border-yellow-200",
  },
  active: {
    label: "Siap Dikerjakan",
    badgeClass: "bg-green-100 text-green-800",
    cardBorder: "border-green-200",
  },
  completed: {
    label: "Selesai",
    badgeClass: "bg-gray-100 text-gray-600",
    cardBorder: "border-gray-200",
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
      if (axiosErr.response?.status === 401) return; // handled by interceptor
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="mx-auto max-w-lg flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Daftar Ujian</h1>
            {user.name && <p className="text-sm text-gray-500">{user.name}</p>}
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Keluar
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-lg px-4 py-6">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
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
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-300"
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
            <p className="mt-3 text-sm text-gray-500">
              Belum ada ujian yang tersedia.
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
                className={`rounded-xl border bg-white p-4 ${config.cardBorder} ${
                  session.status === "active"
                    ? "cursor-pointer hover:shadow-md transition-shadow"
                    : ""
                }`}
                onClick={() => handleStartExam(session)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {session.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {session.subject}
                    </p>
                  </div>
                  <span
                    className={`ml-2 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.badgeClass}`}
                  >
                    {config.label}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
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
                  <div className="mt-3">
                    <button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800">
                      Mulai Ujian
                    </button>
                  </div>
                )}

                {session.status === "completed" && (
                  <div className="mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/result/${session.id}`);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
