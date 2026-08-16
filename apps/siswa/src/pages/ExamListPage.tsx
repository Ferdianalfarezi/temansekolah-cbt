import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/services/api";

interface ExamSession {
  sessionId: string;
  sessionStatus: "packaged" | "active" | "completed";
  durationMinutes: number;
  scheduledAt?: string;
  submittedAt?: string;
  mataPelajaranId?: string;
  kelasId?: string;
  participantStatus?: string;
  resultsReleased?: boolean;
  score?: { correct: number; total: number; percentage: number } | null;
  // Readable names from backend
  title?: string;
  subject?: string;
  questionCount?: number;
}

// Icons as components for cleaner code
const Icons = {
  Clock: () => (
    <svg
      className="w-4 h-4"
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
  ),
  Calendar: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
      />
    </svg>
  ),
  Questions: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
      />
    </svg>
  ),
  Logout: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
      />
    </svg>
  ),
  Book: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
      />
    </svg>
  ),
  Play: () => (
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
        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
      />
    </svg>
  ),
  Trophy: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-2.992 0"
      />
    </svg>
  ),
  Empty: () => (
    <svg
      className="w-16 h-16"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  ),
  ChevronRight: () => (
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
        d="m8.25 4.5 7.5 7.5-7.5 7.5"
      />
    </svg>
  ),
};

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
      setSessions(res.data.sessions ?? res.data ?? []);
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

  // Group sessions by status
  const { activeSessions, upcomingSessions, completedSessions } =
    useMemo(() => {
      const active: ExamSession[] = [];
      const upcoming: ExamSession[] = [];
      const completed: ExamSession[] = [];

      sessions.forEach((s) => {
        if (s.sessionStatus === "active") active.push(s);
        else if (s.sessionStatus === "packaged") upcoming.push(s);
        else if (s.sessionStatus === "completed") completed.push(s);
      });

      // Sort upcoming by scheduledAt
      upcoming.sort((a, b) => {
        if (!a.scheduledAt || !b.scheduledAt) return 0;
        return (
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        );
      });

      return {
        activeSessions: active,
        upcomingSessions: upcoming,
        completedSessions: completed,
      };
    }, [sessions]);

  function formatDuration(minutes: number): string {
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m > 0 ? `${h} jam ${m} menit` : `${h} jam`;
    }
    return `${minutes} menit`;
  }

  function formatScheduleTime(dateStr?: string): string {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) return "Sudah lewat";
    if (diffHours < 1) return "Kurang dari 1 jam lagi";
    if (diffHours < 24) return `${diffHours} jam lagi`;
    if (diffDays === 1) return "Besok";
    if (diffDays < 7) return `${diffDays} hari lagi`;

    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }

  function formatFullDate(dateStr?: string): string {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-20"
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & User Info */}
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-10 h-10 rounded-xl"
                style={{ background: "var(--primary-bg)" }}
              >
                <Icons.Book />
              </div>
              <div className="hidden sm:block">
                <p
                  className="font-semibold text-sm"
                  style={{ color: "var(--text)" }}
                >
                  {user.name || "Siswa"}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  CBT Teman Sekolah
                </p>
              </div>
            </div>

            {/* Mobile: Just name */}
            <div className="sm:hidden flex-1 text-center">
              <p
                className="font-semibold text-sm"
                style={{ color: "var(--text)" }}
              >
                {user.name || "Siswa"}
              </p>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              <Icons.Logout />
              <span className="hidden sm:inline text-sm font-medium">
                Keluar
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl p-5"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="skeleton w-12 h-12 rounded-xl" />
                  <div className="flex-1 space-y-3">
                    <div className="skeleton h-5 w-3/4 rounded" />
                    <div className="skeleton h-4 w-1/2 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div
            className="rounded-xl p-4 mb-6"
            style={{
              background: "var(--red-bg)",
              border: "1px solid var(--red-border)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--red-text)" }}>
              {error}
            </p>
            <button
              onClick={() => {
                setError("");
                setLoading(true);
                fetchSessions();
              }}
              className="mt-2 text-sm font-medium underline"
              style={{ color: "var(--red)" }}
            >
              Coba lagi
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && sessions.length === 0 && (
          <div className="text-center py-16">
            <div
              className="mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-6"
              style={{
                background: "var(--bg-secondary)",
                color: "var(--text-light)",
              }}
            >
              <Icons.Empty />
            </div>
            <h3
              className="text-lg font-semibold mb-2"
              style={{ color: "var(--text)" }}
            >
              Belum Ada Ujian
            </h3>
            <p
              className="text-sm max-w-sm mx-auto"
              style={{ color: "var(--text-muted)" }}
            >
              Ujian yang dijadwalkan untukmu akan muncul di sini. Pastikan kamu
              sudah terdaftar di kelas yang benar.
            </p>
          </div>
        )}

        {/* Content Sections */}
        {!loading && !error && sessions.length > 0 && (
          <div className="space-y-8">
            {/* Active Exams - Priority Section */}
            {activeSessions.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-2 h-2 rounded-full status-active-dot"
                    style={{ background: "var(--emerald)" }}
                  />
                  <h2
                    className="text-lg font-semibold"
                    style={{ color: "var(--text)" }}
                  >
                    Siap Dikerjakan
                  </h2>
                  <span
                    className="ml-auto text-xs font-medium px-2 py-1 rounded-full"
                    style={{
                      background: "var(--emerald-bg)",
                      color: "var(--emerald-text)",
                    }}
                  >
                    {activeSessions.length} ujian
                  </span>
                </div>

                <div className="space-y-3">
                  {activeSessions.map((session) => {
                    const isSubmitted = [
                      "submitted",
                      "auto_submitted",
                    ].includes(session.participantStatus || "");

                    return (
                      <div
                        key={session.sessionId}
                        className={
                          isSubmitted
                            ? "rounded-2xl p-5"
                            : "card-hover rounded-2xl p-5 cursor-pointer"
                        }
                        style={{
                          background: "var(--surface)",
                          border: isSubmitted
                            ? "2px solid var(--border)"
                            : "2px solid var(--emerald)",
                          boxShadow: "var(--shadow)",
                          opacity: isSubmitted ? 0.8 : 1,
                        }}
                        onClick={() => {
                          if (isSubmitted) {
                            navigate(`/result/${session.sessionId}`);
                          } else {
                            navigate(`/exam/${session.sessionId}`);
                          }
                        }}
                      >
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div
                            className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{
                              background: isSubmitted
                                ? "var(--bg-secondary)"
                                : "var(--emerald-bg)",
                              color: isSubmitted
                                ? "var(--text-muted)"
                                : "var(--emerald)",
                            }}
                          >
                            {isSubmitted ? <Icons.Trophy /> : <Icons.Play />}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3
                                  className="font-semibold"
                                  style={{ color: "var(--text)" }}
                                >
                                  {session.title || "Ujian"}
                                </h3>
                                <p
                                  className="text-sm mt-0.5"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  {session.subject || "-"}
                                </p>
                              </div>
                              <span
                                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                                style={{
                                  background: isSubmitted
                                    ? "var(--bg-secondary)"
                                    : "var(--emerald-bg)",
                                  color: isSubmitted
                                    ? "var(--text-muted)"
                                    : "var(--emerald-text)",
                                }}
                              >
                                {isSubmitted ? (
                                  <>
                                    <svg
                                      className="w-3 h-3"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                    Sudah Dikumpulkan
                                  </>
                                ) : (
                                  <>
                                    <span
                                      className="w-1.5 h-1.5 rounded-full status-active-dot"
                                      style={{ background: "var(--emerald)" }}
                                    />
                                    Aktif
                                  </>
                                )}
                              </span>
                            </div>

                            {/* Meta info */}
                            <div
                              className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm"
                              style={{ color: "var(--text-muted)" }}
                            >
                              <span className="flex items-center gap-1.5">
                                <Icons.Clock />
                                {formatDuration(session.durationMinutes)}
                              </span>
                              {session.questionCount != null && (
                                <span className="flex items-center gap-1.5">
                                  <Icons.Questions />
                                  {session.questionCount} soal
                                </span>
                              )}
                            </div>

                            {/* CTA Button */}
                            {isSubmitted ? (
                              <button
                                className="w-full mt-4 py-3 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold"
                                style={{
                                  background: "var(--bg-secondary)",
                                  color: "var(--text-muted)",
                                  border: "1px solid var(--border)",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/result/${session.sessionId}`);
                                }}
                              >
                                <Icons.Trophy />
                                Lihat Hasil
                              </button>
                            ) : (
                              <button
                                className="btn-primary w-full mt-4 py-3 flex items-center justify-center gap-2"
                                style={{ background: "var(--emerald)" }}
                              >
                                <Icons.Play />
                                Mulai Ujian Sekarang
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Upcoming Exams */}
            {upcomingSessions.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h2
                    className="text-lg font-semibold"
                    style={{ color: "var(--text)" }}
                  >
                    Ujian Mendatang
                  </h2>
                  <span
                    className="ml-auto text-xs font-medium px-2 py-1 rounded-full"
                    style={{
                      background: "var(--blue-bg)",
                      color: "var(--blue-text)",
                    }}
                  >
                    {upcomingSessions.length} ujian
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {upcomingSessions.map((session) => (
                    <div
                      key={session.sessionId}
                      className="rounded-2xl p-4 sm:p-5"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        boxShadow: "var(--shadow-sm)",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div
                          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{
                            background: "var(--blue-bg)",
                            color: "var(--blue)",
                          }}
                        >
                          <Icons.Calendar />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3
                            className="font-semibold text-sm truncate"
                            style={{ color: "var(--text)" }}
                          >
                            {session.title || "Ujian"}
                          </h3>
                          <p
                            className="text-xs mt-0.5 truncate"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {session.subject || "-"}
                          </p>
                        </div>

                        {/* Time badge */}
                        <span
                          className="shrink-0 text-xs font-medium px-2 py-1 rounded-lg"
                          style={{
                            background: "var(--blue-bg)",
                            color: "var(--blue-text)",
                          }}
                        >
                          {formatScheduleTime(session.scheduledAt)}
                        </span>
                      </div>

                      {/* Details */}
                      <div
                        className="mt-4 pt-3 flex items-center gap-4 text-xs"
                        style={{
                          borderTop: "1px solid var(--border-light)",
                          color: "var(--text-muted)",
                        }}
                      >
                        <span className="flex items-center gap-1.5">
                          <Icons.Clock />
                          {formatDuration(session.durationMinutes)}
                        </span>
                        {session.questionCount != null && (
                          <span className="flex items-center gap-1.5">
                            <Icons.Questions />
                            {session.questionCount} soal
                          </span>
                        )}
                      </div>

                      {/* Full date on hover/focus for desktop */}
                      {session.scheduledAt && (
                        <p
                          className="mt-2 text-xs"
                          style={{ color: "var(--text-light)" }}
                        >
                          {formatFullDate(session.scheduledAt)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Completed Exams */}
            {completedSessions.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h2
                    className="text-lg font-semibold"
                    style={{ color: "var(--text)" }}
                  >
                    Riwayat Ujian
                  </h2>
                  <span
                    className="ml-auto text-xs font-medium px-2 py-1 rounded-full"
                    style={{
                      background: "var(--bg-secondary)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {completedSessions.length} selesai
                  </span>
                </div>

                <div className="space-y-2">
                  {completedSessions.map((session) => (
                    <div
                      key={session.sessionId}
                      className="rounded-xl p-4"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {/* Icon */}
                        <div
                          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{
                            background: "var(--bg-secondary)",
                            color: "var(--text-muted)",
                          }}
                        >
                          <Icons.Book />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3
                            className="font-medium text-sm truncate"
                            style={{ color: "var(--text)" }}
                          >
                            {session.title || "Ujian"}
                          </h3>
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {session.subject || "-"}
                          </p>
                        </div>

                        {/* Completed badge */}
                        <span
                          className="shrink-0 text-xs font-medium px-2 py-1 rounded-lg"
                          style={{
                            background: "var(--bg-secondary)",
                            color: "var(--text-muted)",
                          }}
                        >
                          Selesai
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Footer - minimal */}
      <footer className="py-6 text-center">
        <p className="text-xs" style={{ color: "var(--text-light)" }}>
          CBT Teman Sekolah © 2026
        </p>
      </footer>
    </div>
  );
}
