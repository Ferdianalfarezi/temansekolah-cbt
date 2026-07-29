import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/services/api";

export default function LoginPage() {
  const navigate = useNavigate();

  const [nisn, setNisn] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Change password state (for first login)
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [tempToken, setTempToken] = useState("");

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/siswa/login", { nisn, password });
      const data = res.data;

      if (data.mustChangePassword) {
        setTempToken(data.accessToken);
        setMustChangePassword(true);
        setLoading(false);
        return;
      }

      localStorage.setItem("cbt_token", data.accessToken);
      navigate("/exams");
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      if (axiosErr.response?.status === 423) {
        setError("Akun terkunci. Silakan coba lagi dalam 15 menit.");
      } else {
        setError(
          axiosErr.response?.data?.message ||
            "Login gagal. Periksa NISN dan password.",
        );
      }
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
      await api.post(
        "/auth/siswa/change-password",
        { currentPassword: password, newPassword },
        { headers: { Authorization: `Bearer ${tempToken}` } },
      );

      // Re-login with new password to get a fresh token
      const loginRes = await api.post("/auth/siswa/login", {
        nisn,
        password: newPassword,
      });
      localStorage.setItem("cbt_token", loginRes.data.accessToken);
      navigate("/exams");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || "Gagal mengubah password.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 text-[15px] border-2 border-stone-200 rounded-lg bg-white placeholder:text-stone-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors";

  // ── Change password form (first login) ──────────────────────────────────
  if (mustChangePassword) {
    return (
      <div className="min-h-screen flex bg-stone-50">
        {/* Left brand panel */}
        <div
          className="hidden lg:flex lg:w-1/2 xl:w-[60%] relative overflow-hidden items-center justify-center p-12"
          style={{
            backgroundImage: "url('/bg.webp')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm" />
          <div className="relative z-10 max-w-md text-stone-900">
            <img
              src="/logo-text.png"
              alt="Teman Sekolah"
              className="h-16 w-56 object-cover object-left -ml-6 mb-8"
            />
            <h1 className="text-3xl font-semibold leading-tight mb-4">
              Ujian berbasis komputer yang mudah dan terpercaya
            </h1>
            <p className="text-base leading-relaxed text-stone-700">
              Kerjakan ujian dengan tenang. Jawaban tersimpan otomatis dan hasil
              tersedia segera setelah ujian selesai.
            </p>
          </div>
        </div>

        {/* Right form */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-sm bg-white rounded-2xl border-2 border-stone-200 shadow-sm p-8">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2.5 mb-8">
              <img
                src="/logo-text.png"
                alt="Teman Sekolah"
                className="h-14 w-36 object-cover object-left -ml-3"
              />
            </div>

            <div className="mb-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 mb-4">
                <svg
                  className="w-6 h-6 text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-stone-900 mb-1">
                Buat password baru
              </h2>
              <p className="text-[15px] text-stone-500">
                Password default telah direset. Silakan buat password baru.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <svg
                  className="w-4 h-4 text-red-500 shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-[15px] text-red-700">{error}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Password Baru
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className={inputClass + " pr-10"}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                    onClick={() => setShowNewPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    <EyeIcon open={showNewPassword} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Konfirmasi Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang password"
                    className={inputClass + " pr-10"}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    <EyeIcon open={showConfirmPassword} />
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-[18px] bg-blue-600 hover:bg-blue-700 hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed text-white text-[14px] font-semibold rounded-lg transition-all"
                style={{ boxShadow: "0 4px 12px rgba(37,99,235,0.3)" }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <SpinnerIcon />
                    Menyimpan...
                  </span>
                ) : (
                  "Simpan Password"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Main login form ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-stone-50">
      {/* Left brand panel */}
      <div
        className="hidden lg:flex lg:w-1/2 xl:w-[60%] relative overflow-hidden items-center justify-center p-12"
        style={{
          backgroundImage: "url('/bg.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-white/70 backdrop-blur-sm" />
        <div className="relative z-10 max-w-md text-stone-900">
          <img
            src="/logo-text.png"
            alt="Teman Sekolah"
            className="h-16 w-56 object-cover object-left -ml-6 mb-8"
          />
          <h1 className="text-3xl font-semibold leading-tight mb-4">
            Ujian berbasis komputer yang mudah dan terpercaya
          </h1>
          <p className="text-base leading-relaxed text-stone-700">
            Kerjakan ujian dengan tenang. Jawaban tersimpan otomatis dan hasil
            tersedia segera setelah ujian selesai.
          </p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm bg-white rounded-2xl border-2 border-stone-200 shadow-sm p-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <img
              src="/logo-text.png"
              alt="Teman Sekolah"
              className="h-14 w-36 object-cover object-left -ml-3"
            />
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-stone-900 mb-1">
              Masuk ke akun Anda
            </h2>
            <p className="text-[15px] text-stone-500">
              Masukkan NISN dan password untuk melanjutkan
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <svg
                className="w-4 h-4 text-red-500 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-[15px] text-red-700">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="nisn"
                className="block text-sm font-medium text-stone-700 mb-1.5"
              >
                NISN
              </label>
              <input
                id="nisn"
                type="text"
                value={nisn}
                onChange={(e) => setNisn(e.target.value)}
                placeholder="Masukkan NISN kamu"
                className={inputClass}
                required
                autoComplete="username"
                inputMode="numeric"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-stone-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className={inputClass + " pr-10"}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-[18px] bg-blue-600 hover:bg-blue-700 hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed text-white text-[14px] font-semibold rounded-lg transition-all"
              style={{ boxShadow: "0 4px 12px rgba(37,99,235,0.3)" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <SpinnerIcon />
                  Memproses...
                </span>
              ) : (
                "Masuk"
              )}
            </button>

            <div className="text-center">
              <a
                href="/reset-password"
                className="text-[14px] text-blue-600 hover:text-blue-700 transition-colors"
              >
                Lupa password?
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Shared icon components ───────────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
      />
    </svg>
  ) : (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth={4}
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
