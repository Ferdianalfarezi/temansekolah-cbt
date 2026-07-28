/**
 * Production seed script — seeds CBT data using the shared LMS database.
 * Uses the existing "Sekolah Contoh" tenant and its LMS data.
 *
 * Run: DATABASE_URL="..." node scripts/seed-prod.mjs
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Resolve pg from the pnpm store
const pg = require(
  resolve(__dirname, "../node_modules/.pnpm/pg@8.22.0/node_modules/pg"),
);
const bcrypt = require(
  resolve(__dirname, "../node_modules/.pnpm/bcrypt@5.1.1/node_modules/bcrypt"),
);

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// ── IDs from existing LMS data ────────────────────────────────────────────────
const TENANT = "00000000-0000-4000-a000-000000000001"; // Sekolah Contoh
const TAHUN_AJARAN = "82086377-0981-40f1-9fbc-8dda3490933f"; // 2026/2027 aktif
const KOMPONEN = "980f726d-166d-41c7-8964-18734c9a1b0a"; // Ujian CBT
const MAPEL_MTK = "00000000-0000-4000-a000-000000000040"; // Matematika
const KELAS_1A = "b0000000-0000-4000-a000-000000000101"; // Kelas 1A
const GURU = "00000000-0000-4000-a000-000000000012"; // Siti Rahayu, S.Pd.
const ADMIN = "00000000-0000-4000-a000-000000000010"; // Admin Sekolah

// Siswa aktif di kelas 1A with their date of birth for default password
const siswaList = [
  {
    id: "f0000000-0000-4000-a000-000000000001",
    nisn: "0002024001",
    nama: "Andi Prasetyo",
    dob: "2015-05-01",
  },
  {
    id: "f0000000-0000-4000-a000-000000000002",
    nisn: "0002024002",
    nama: "Budi Santoso",
    dob: "2015-06-12",
  },
  {
    id: "f0000000-0000-4000-a000-000000000003",
    nisn: "0002024003",
    nama: "Cahyo Wibowo",
    dob: "2015-07-20",
  },
  {
    id: "f0000000-0000-4000-a000-000000000004",
    nisn: "0002024004",
    nama: "Dimas Aditya",
    dob: "2015-08-03",
  },
  {
    id: "f0000000-0000-4000-a000-000000000005",
    nisn: "0002024005",
    nama: "Eko Saputra",
    dob: "2015-09-15",
  },
];

// ── Soal Matematika Kelas 1 ───────────────────────────────────────────────────
const questions = [
  {
    no: 1,
    soal: "Berapakah hasil dari 15 + 27?",
    a: "40",
    b: "42",
    c: "43",
    d: "45",
    jwb: "B",
  },
  {
    no: 2,
    soal: "Jika 8 × 6 = ?, maka hasilnya adalah...",
    a: "42",
    b: "46",
    c: "48",
    d: "50",
    jwb: "C",
  },
  {
    no: 3,
    soal: "Sebuah persegi panjang mempunyai panjang 12 cm dan lebar 5 cm. Keliling persegi panjang tersebut adalah...",
    a: "30 cm",
    b: "34 cm",
    c: "60 cm",
    d: "17 cm",
    jwb: "B",
  },
  {
    no: 4,
    soal: "Hasil dari 100 ÷ 4 adalah...",
    a: "20",
    b: "24",
    c: "25",
    d: "30",
    jwb: "C",
  },
  {
    no: 5,
    soal: "Nilai dari 3² + 4² adalah...",
    a: "7",
    b: "14",
    c: "25",
    d: "49",
    jwb: "C",
  },
  {
    no: 6,
    soal: "FPB dari 12 dan 18 adalah...",
    a: "2",
    b: "4",
    c: "6",
    d: "9",
    jwb: "C",
  },
  {
    no: 7,
    soal: "KPK dari 4 dan 6 adalah...",
    a: "8",
    b: "12",
    c: "16",
    d: "24",
    jwb: "B",
  },
  {
    no: 8,
    soal: "1/2 + 1/4 = ...",
    a: "2/6",
    b: "1/2",
    c: "3/4",
    d: "1",
    jwb: "C",
  },
  {
    no: 9,
    soal: "Jika harga 1 kg apel Rp 15.000, maka harga 3 kg apel adalah...",
    a: "Rp 30.000",
    b: "Rp 40.000",
    c: "Rp 45.000",
    d: "Rp 50.000",
    jwb: "C",
  },
  {
    no: 10,
    soal: "Sebuah lingkaran mempunyai diameter 14 cm. Luas lingkaran tersebut adalah... (π = 22/7)",
    a: "44 cm²",
    b: "88 cm²",
    c: "154 cm²",
    d: "196 cm²",
    jwb: "C",
  },
];

async function run() {
  console.log("🌱 Starting CBT production seed...\n");

  try {
    // ── 1. Tenant config ──────────────────────────────────────────────────────
    console.log("  → cbt_tenant_config...");
    await pool.query(
      `INSERT INTO cbt_tenant_config (id, tenant_id, timezone, default_anti_cheat_level, max_violation_count, early_submission_threshold_pct, default_result_detail_level)
       VALUES (gen_random_uuid(), $1, 'Asia/Jakarta', 'standard', 3, 20, 'score_only')
       ON CONFLICT (tenant_id) DO NOTHING`,
      [TENANT],
    );

    // ── 2. Pelaksanaan ujian ──────────────────────────────────────────────────
    console.log("  → cbt_pelaksanaan_ujian...");
    await pool.query(
      `INSERT INTO cbt_pelaksanaan_ujian (id, tenant_id, tahun_ajaran_id, periode_rapor, komponen_penilaian_id, nama, is_active)
       VALUES (gen_random_uuid(), $1, $2, 'uts_semester_1', $3, 'UTS Semester 1 - Ujian CBT', true)
       ON CONFLICT ON CONSTRAINT uq_cbt_pu_tenant_periode_komponen DO NOTHING`,
      [TENANT, TAHUN_AJARAN, KOMPONEN],
    );

    const puRow = await pool.query(
      "SELECT id FROM cbt_pelaksanaan_ujian WHERE tenant_id = $1 AND is_active = true LIMIT 1",
      [TENANT],
    );
    const PU_ID = puRow.rows[0].id;
    console.log("    PU ID:", PU_ID);

    // ── 3. Questions ──────────────────────────────────────────────────────────
    console.log("  → cbt_question (10 soal Matematika)...");
    for (const q of questions) {
      await pool.query(
        `INSERT INTO cbt_question (id, tenant_id, pelaksanaan_ujian_id, mata_pelajaran_id, tingkat, created_by, teks_soal, opsi_a, opsi_b, opsi_c, opsi_d, jawaban_benar, nomor_urut)
         VALUES (gen_random_uuid(), $1, $2, $3, 1, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          TENANT,
          PU_ID,
          MAPEL_MTK,
          GURU,
          q.soal,
          q.a,
          q.b,
          q.c,
          q.d,
          q.jwb,
          q.no,
        ],
      );
    }

    // ── 4. Exam session (active in 5 minutes) ─────────────────────────────────
    console.log("  → cbt_exam_session (scheduled in 5 min)...");
    const scheduledAt = new Date(Date.now() + 5 * 60 * 1000);
    const sessionResult = await pool.query(
      `INSERT INTO cbt_exam_session (id, tenant_id, pelaksanaan_ujian_id, mata_pelajaran_id, kelas_id, proctor_id, status, scheduled_at, duration_minutes, randomize_questions, randomize_options, anti_cheat_level, result_detail_level, results_released)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'packaged', $6, 60, true, true, 'standard', 'score_only', false)
       RETURNING id`,
      [TENANT, PU_ID, MAPEL_MTK, KELAS_1A, ADMIN, scheduledAt],
    );
    const SESSION_ID = sessionResult.rows[0].id;
    console.log("    Session ID:", SESSION_ID);

    // ── 5. Snapshot questions into session ────────────────────────────────────
    console.log("  → cbt_exam_session_question...");
    const qRows = await pool.query(
      "SELECT id, nomor_urut FROM cbt_question WHERE pelaksanaan_ujian_id = $1 AND mata_pelajaran_id = $2 ORDER BY nomor_urut",
      [PU_ID, MAPEL_MTK],
    );
    for (const q of qRows.rows) {
      await pool.query(
        "INSERT INTO cbt_exam_session_question (id, exam_session_id, question_id, nomor_urut) VALUES (gen_random_uuid(), $1, $2, $3)",
        [SESSION_ID, q.id, q.nomor_urut],
      );
    }
    console.log("    Snapshotted", qRows.rows.length, "questions");

    // ── 6. Siswa accounts + participants ──────────────────────────────────────
    console.log("  → cbt_siswa_account + cbt_exam_participant (5 siswa)...");
    for (const s of siswaList) {
      const [y, m, d] = s.dob.split("-");
      const defaultPw = `${d}${m}${y}`;
      const hash = await bcrypt.hash(defaultPw, 10);

      await pool.query(
        `INSERT INTO cbt_siswa_account (id, tenant_id, siswa_id, nisn, password_hash, must_change_password, failed_login_attempts, is_active, needs_review)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, 0, true, false)
         ON CONFLICT (tenant_id, nisn) DO NOTHING`,
        [TENANT, s.id, s.nisn, hash],
      );

      const accRow = await pool.query(
        "SELECT id FROM cbt_siswa_account WHERE tenant_id = $1 AND nisn = $2",
        [TENANT, s.nisn],
      );
      if (accRow.rows[0]) {
        await pool.query(
          `INSERT INTO cbt_exam_participant (id, exam_session_id, siswa_account_id, status, violation_count, extension_seconds, is_flagged_cheating, is_early_submission)
           VALUES (gen_random_uuid(), $1, $2, 'assigned', 0, 0, false, false)
           ON CONFLICT (exam_session_id, siswa_account_id) DO NOTHING`,
          [SESSION_ID, accRow.rows[0].id],
        );
      }
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log("\n✅ Seeding complete!\n");
    console.log("📋 Summary:");
    console.log("   Tenant         : Sekolah Contoh");
    console.log("   Pelaksanaan    : UTS Semester 1 - Ujian CBT (active)");
    console.log("   Mapel          : Matematika, Kelas 1A");
    console.log("   Soal           : 10 pilihan ganda");
    console.log(
      "   Sesi Ujian     : packaged, activates at",
      scheduledAt.toLocaleString("id-ID"),
    );
    console.log("   Session ID     :", SESSION_ID);
    console.log("\n👤 Siswa Accounts (NISN → password default):");
    for (const s of siswaList) {
      const [y, m, d] = s.dob.split("-");
      console.log(`   ${s.nisn}  →  ${d}${m}${y}  (${s.nama})`);
    }
  } catch (e) {
    console.error("❌ Seed failed:", e.message);
    console.error(e.stack);
  } finally {
    await pool.end();
  }
}

run();
