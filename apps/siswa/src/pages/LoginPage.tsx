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

      // Store token and user info
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

  // Change password form (first login)
  if (mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-blue-50 to-white px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <svg
                className="h-6 w-6 text-blue-700"
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
            <h1 className="text-xl font-bold text-gray-900">Ubah Password</h1>
            <p className="mt-1 text-sm text-gray-600">
              Buat password baru untuk akun Anda
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password Baru
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Konfirmasi Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang password"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
    <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-blue-50 to-white px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <svg
              className="h-6 w-6 text-blue-700"
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
          <h1 className="text-2xl font-bold text-gray-900">
            CBT Teman Sekolah
          </h1>
          <p className="mt-1 text-sm text-gray-600">Masuk dengan akun siswa</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="text"
              value={nisn}
              onChange={(e) => setNisn(e.target.value)}
              placeholder="NISN"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
              autoComplete="username"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Masuk..." : "Masuk"}
          </button>
        </form>

        <div className="text-center">
          <a
            href="/reset-password"
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            Lupa password?
          </a>
        </div>
      </div>
    </div>
  );
}
