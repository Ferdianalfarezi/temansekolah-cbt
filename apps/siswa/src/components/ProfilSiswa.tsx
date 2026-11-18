import { useEffect, useState } from "react";
import api from "@/services/api";

/** Data diri siswa dari GET /auth/siswa/me (hanya dilihat, diubah oleh admin sekolah). */
export interface ProfilSiswaData {
  nama: string;
  nisn: string | null;
  jenisKelamin: string | null;
  tanggalLahir: string | null;
  alamat: string | null;
  status: string | null;
  kelas: string | null;
  waliKelas: string | null;
  tahunAjaran: string | null;
  sekolah: string | null;
}

export function useProfilSiswa() {
  const [profil, setProfil] = useState<ProfilSiswaData | null>(null);

  useEffect(() => {
    let aktif = true;
    api
      .get<ProfilSiswaData>("/auth/siswa/me")
      .then((res) => {
        if (aktif) setProfil(res.data);
      })
      .catch(() => {
        // Tidak kritis: header tetap tampil dengan teks "Siswa"
      });
    return () => {
      aktif = false;
    };
  }, []);

  return profil;
}

function inisial(nama?: string) {
  return nama?.trim().charAt(0).toUpperCase() || "S";
}

function formatTanggal(t: string | null) {
  if (!t) return "-";
  return new Date(`${t}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const JENIS_KELAMIN: Record<string, string> = {
  L: "Laki-laki",
  P: "Perempuan",
};

const STATUS: Record<string, string> = {
  aktif: "Aktif",
  lulus: "Lulus",
  tidak_aktif: "Tidak aktif",
  nonaktif: "Tidak aktif",
};

function Avatar({ nama, size }: { nama?: string; size: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0 font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: "var(--amber)",
      }}
    >
      {inisial(nama)}
    </div>
  );
}

/** Kartu nama di header: avatar + nama + kelas. Klik untuk melihat data diri. */
export function ProfilSiswaChip({
  profil,
  onClick,
  gelap = false,
}: {
  profil: ProfilSiswaData | null;
  onClick: () => void;
  /** true = dipakai di atas latar biru (teks putih) */
  gelap?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Lihat data diri"
      className={`flex items-center gap-2.5 min-w-0 px-2 py-1.5 rounded-xl transition-colors ${
        gelap ? "hover:bg-white/10" : "hover:bg-[var(--surface-hover)]"
      }`}
    >
      <Avatar nama={profil?.nama} size={38} />
      <div className="min-w-0 text-left">
        <p
          className="font-semibold text-sm truncate max-w-[9rem] sm:max-w-[14rem]"
          style={{ color: gelap ? "#fff" : "var(--text)" }}
        >
          {profil?.nama ?? "Siswa"}
        </p>
        <p
          className="text-xs truncate max-w-[9rem] sm:max-w-[14rem]"
          style={{
            color: gelap ? "rgba(255,255,255,0.75)" : "var(--text-muted)",
          }}
        >
          {profil?.kelas ? `Kelas ${profil.kelas}` : "Siswa"}
        </p>
      </div>
    </button>
  );
}

/** Modal data diri siswa (hanya lihat). */
export function ProfilSiswaModal({
  profil,
  open,
  onClose,
}: {
  profil: ProfilSiswaData | null;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const tutup = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", tutup);
    return () => window.removeEventListener("keydown", tutup);
  }, [open, onClose]);

  if (!open) return null;

  const baris: Array<[string, string]> = [
    ["NISN", profil?.nisn || "-"],
    [
      "Jenis kelamin",
      (profil?.jenisKelamin && JENIS_KELAMIN[profil.jenisKelamin]) || "-",
    ],
    ["Tanggal lahir", formatTanggal(profil?.tanggalLahir ?? null)],
    ["Alamat", profil?.alamat || "-"],
    ["Kelas", profil?.kelas || "-"],
    ["Wali kelas", profil?.waliKelas || "-"],
    ["Tahun ajaran", profil?.tahunAjaran || "-"],
    ["Sekolah", profil?.sekolah || "-"],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(28, 25, 23, 0.45)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Data diri siswa"
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-4 px-6 py-5"
          style={{
            background: "var(--primary-bg)",
            borderBottom: "1px solid var(--primary-border)",
          }}
        >
          <Avatar nama={profil?.nama} size={56} />
          <div className="min-w-0 flex-1">
            <p
              className="font-bold text-lg leading-tight"
              style={{ color: "var(--text)" }}
            >
              {profil?.nama ?? "Siswa"}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                {profil?.kelas ? `Kelas ${profil.kelas}` : "Siswa"}
              </span>
              {profil?.status && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: "var(--emerald-bg)",
                    color: "var(--emerald-text)",
                    border: "1px solid var(--emerald-border)",
                  }}
                >
                  {STATUS[profil.status] ?? profil.status}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="self-start p-1.5 rounded-lg transition-colors hover:bg-white/70"
            style={{ color: "var(--text-muted)" }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <dl className="px-6 py-2">
          {baris.map(([label, nilai]) => (
            <div
              key={label}
              className="flex gap-4 py-2.5"
              style={{ borderBottom: "1px solid var(--border-light)" }}
            >
              <dt
                className="w-32 shrink-0 text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                {label}
              </dt>
              <dd
                className="flex-1 min-w-0 text-sm font-medium break-words"
                style={{ color: "var(--text)" }}
              >
                {nilai}
              </dd>
            </div>
          ))}
        </dl>

        <p
          className="px-6 pb-5 pt-2 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Ada data yang salah? Hubungi wali kelas atau admin sekolah untuk
          memperbaikinya.
        </p>
      </div>
    </div>
  );
}
