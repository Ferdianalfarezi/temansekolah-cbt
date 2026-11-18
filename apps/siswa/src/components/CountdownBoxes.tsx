/**
 * Hitung mundur dalam kotak terpisah: Hari / Jam / Menit / Detik.
 * Kotak "Hari" hanya tampil kalau masih lebih dari 1 hari.
 */
export default function CountdownBoxes({
  seconds,
  color,
  background,
}: {
  seconds: number;
  color: string;
  background: string;
}) {
  const s = Math.max(0, seconds);
  const hari = Math.floor(s / 86400);
  const bagian: Array<[number, string]> = [
    ...(hari > 0 ? ([[hari, "Hari"]] as Array<[number, string]>) : []),
    [Math.floor((s % 86400) / 3600), "Jam"],
    [Math.floor((s % 3600) / 60), "Menit"],
    [s % 60, "Detik"],
  ];

  return (
    <div className="flex items-start justify-center gap-1.5 sm:gap-2">
      {bagian.map(([nilai, label], i) => (
        <div key={label} className="flex items-start gap-1.5 sm:gap-2">
          {i > 0 && (
            <span
              className="text-xl font-bold leading-[2.75rem]"
              style={{ color, opacity: 0.5 }}
            >
              :
            </span>
          )}
          <div className="flex flex-col items-center">
            <span
              className="w-12 sm:w-14 h-11 rounded-lg flex items-center justify-center text-xl sm:text-2xl font-bold"
              style={{
                background,
                color,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {String(nilai).padStart(2, "0")}
            </span>
            <span
              className="mt-1 text-[10px] font-semibold uppercase tracking-wide"
              style={{ color, opacity: 0.75 }}
            >
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
