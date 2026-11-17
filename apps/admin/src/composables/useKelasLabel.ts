import { ref } from "vue";

/**
 * Tingkat disimpan relatif per jenjang (SD 1–6, SMP 1–3, SMA 1–3) di LMS,
 * tapi ditampilkan sebagai kelas nasional: SMP tingkat 1 = "Kelas 7", SMA tingkat 1 = "Kelas 10".
 *
 * Jenjang diisi dari response GET /bank-soal/scope (setJenjang) setiap halaman memuat scope.
 */
const KELAS_OFFSET: Record<string, number> = { sd: 0, smp: 6, sma: 9 };

const jenjang = ref<string | null>(null);

export function setJenjang(value: string | null | undefined) {
  jenjang.value = value ?? null;
}

/** "Kelas 7" bila jenjang diketahui, selain itu "Tingkat N". */
export function kelasLabel(tingkat: number | null | undefined): string {
  if (tingkat === null || tingkat === undefined) return "-";
  const offset = jenjang.value ? KELAS_OFFSET[jenjang.value] : undefined;
  return offset !== undefined ? `Kelas ${tingkat + offset}` : `Tingkat ${tingkat}`;
}
