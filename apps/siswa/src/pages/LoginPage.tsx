import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/services/api";

export default function LoginPage() {
  const navigate = useNavigate();

  const [nisn, setNisn] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Change password state (for first login)
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [tempToken, setTempToken] = useState("");

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/siswa/login", { nisn, password });
      const data = res.data;

      if (data.mustChangePassword) {
        setTempToken(data.token);
        setMustChangePassword(true);
        setLoading(false);
        return;
      }

      localStorage.setItem("cbt_token", data.token);
      localStorage.setItem("cbt_user", JSON.stringify(data.user));
      navigate("/exams");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message ||
          "Login gagal. Periksa NISN dan password.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post(
        "/auth/siswa/change-password",
        { newPassword },
        { headers: { Authorization: `Bearer ${tempToken}` } },
      );
      const data = res.data;

      localStorage.setItem("cbt_token", data.token);
      localStorage.setItem("cbt_user", JSON.stringify(data.user));
      navigate("/exams");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || "Gagal mengubah password.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg px-4 py-3 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--amber)] transition-all";

  // Change password form (first login)
  if (mustChangePassword) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: "var(--bg)" }}
      >
        {/* Grid pattern background */}
        <div
          className="pointer-events-none fixed inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.03) 39px, rgba(255,255,255,0.03) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.03) 39px, rgba(255,255,255,0.03) 40px)",
          }}
        />

        <div
          className="relative w-full max-w-sm rounded-2xl p-8 space-y-6"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Icon */}
          <div className="text-center">
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "var(--amber-glow)" }}
            >
              <svg
                className="h-6 w-6"
                style={{ color: "var(--amber)" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1
              className="text-xl font-semibold"
              style={{ color: "var(--text)" }}
            >
              Ubah Password
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              Buat password baru untuk akun Anda
            </p>
          </div>

          {error && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#fca5a5",
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                style={{ color: "var(--text-muted)" }}
              >
                Password Baru
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className={inputClass}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                }}
                required
                minLength={6}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                style={{ color: "var(--text-muted)" }}
              >
                Konfirmasi Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang password"
                className={inputClass}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                }}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg px-4 py-3 text-sm font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--amber)", color: "#0f1117" }}
            >
              {loading ? "Menyimpan..." : "Simpan Password"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main login form
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "var(--bg)" }}
    >
      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.03) 39px, rgba(255,255,255,0.03) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.03) 39px, rgba(255,255,255,0.03) 40px)",
        }}
      />

      <div
        className="relative w-full max-w-sm rounded-2xl p-8 space-y-6"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Logo */}
        <div className="text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: "var(--amber-glow)" }}
          >
            <svg
              className="h-6 w-6"
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
          <h1
            className="text-2xl"
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              color: "var(--text)",
            }}
          >
            CBT Teman Sekolah
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Portal Ujian Siswa
          </p>
        </div>

        {error && (
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#fca5a5",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="text"
            value={nisn}
            onChange={(e) => setNisn(e.target.value)}
            placeholder="NISN"
            className={inputClass}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
            required
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className={inputClass}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
            required
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg px-4 py-3 text-sm font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--amber)", color: "#0f1117" }}
          >
            {loading ? "Masuk..." : "Masuk"}
          </button>
        </form>

        <div className="text-center">
          <a
            href="/reset-password"
            className="text-sm transition-colors hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            Lupa password?
          </a>
        </div>
      </div>
    </div>
  );
}
