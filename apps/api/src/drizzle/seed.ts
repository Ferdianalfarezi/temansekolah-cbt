/**
 * CBT Teman Sekolah — Development Seed Script
 *
 * Seeds CBT-owned tables with sample data for local development.
 * Assumes the LMS tables (tenant, tahun_ajaran, user, siswa, kelas,
 * mata_pelajaran, komponen_penilaian) already exist with matching UUIDs.
 *
 * Idempotent: uses ON CONFLICT DO NOTHING so it can be run multiple times safely.
 *
 * Usage: pnpm --filter @cbt/api db:seed
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as bcrypt from "bcrypt";

import { cbtTenantConfig } from "./schema/cbt-tenant-config";
import { cbtPelaksanaanUjian } from "./schema/cbt-pelaksanaan-ujian";
import { cbtQuestion } from "./schema/cbt-question";
import { cbtExamSession } from "./schema/cbt-exam-session";
import { cbtSiswaAccount } from "./schema/cbt-siswa-account";

// ─── LMS Placeholder UUIDs ────────────────────────────────────────────────────
// These must match existing records in the LMS database.
// If running against the LMS dev seed, use the same IDs from apps/api/src/drizzle/seed.ts
// in the main edu project.
const LMS_IDS = {
  // tenant(id) — the school tenant
  tenant: "00000000-0000-4000-a000-000000000001",
  // tahun_ajaran(id) — active academic year 2024/2025
  tahunAjaran: "00000000-0000-4000-a000-000000000020",
  // komponen_penilaian(id) — e.g., "Pengetahuan" component
  komponenPenilaian: "00000000-0000-4000-a000-000000000070",
  // mata_pelajaran(id) — Matematika
  mataPelajaranMtk: "00000000-0000-4000-a000-000000000040",
  // kelas(id) — Kelas 10A (or 1A in existing LMS seed)
  kelas10A: "00000000-0000-4000-a000-000000000030",
  // user(id) — guru who creates questions
  guru1: "00000000-0000-4000-a000-000000000012",
  // user(id) — proctor/admin for exam sessions
  admin: "00000000-0000-4000-a000-000000000010",
  // siswa(id) — student records in LMS
  siswa1: "00000000-0000-4000-a000-000000000050",
  siswa2: "00000000-0000-4000-a000-000000000051",
} as const;

// ─── CBT-Owned IDs (hardcoded for idempotency) ───────────────────────────────
const CBT_IDS = {
  tenantConfig: "10000000-0000-4000-b000-000000000001",
  pelaksanaanUjian: "10000000-0000-4000-b000-000000000010",
  question1: "10000000-0000-4000-b000-000000000020",
  question2: "10000000-0000-4000-b000-000000000021",
  question3: "10000000-0000-4000-b000-000000000022",
  question4: "10000000-0000-4000-b000-000000000023",
  question5: "10000000-0000-4000-b000-000000000024",
  examSession: "10000000-0000-4000-b000-000000000030",
  siswaAccount1: "10000000-0000-4000-b000-000000000040",
  siswaAccount2: "10000000-0000-4000-b000-000000000041",
} as const;

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is not set");
    console.error("   Create a .env file or set it in your shell.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  console.log("🌱 CBT Seed: Starting...\n");

  try {
    // 1. Tenant Config
    console.log("  → Seeding cbt_tenant_config...");
    await db
      .insert(cbtTenantConfig)
      .values({
        id: CBT_IDS.tenantConfig,
        tenantId: LMS_IDS.tenant,
        timezone: "Asia/Jakarta",
        defaultAntiCheatLevel: "standard",
        maxViolationCount: 3,
        earlySubmissionThresholdPct: 20,
        defaultResultDetailLevel: "score_only",
      })
      .onConflictDoNothing();

    // 2. Pelaksanaan Ujian (active exam administration)
    console.log("  → Seeding cbt_pelaksanaan_ujian...");
    await db
      .insert(cbtPelaksanaanUjian)
      .values({
        id: CBT_IDS.pelaksanaanUjian,
        tenantId: LMS_IDS.tenant,
        tahunAjaranId: LMS_IDS.tahunAjaran,
        periodeRapor: "uts_semester_1",
        komponenPenilaianId: LMS_IDS.komponenPenilaian,
        nama: "UTS Semester 1 - Pengetahuan",
        isActive: true,
      })
      .onConflictDoNothing();

    // 3. Questions (5 Matematika questions, Kelas 10, multiple choice A-E)
    console.log("  → Seeding cbt_question (5 soal Matematika)...");
    const questions = [
      {
        id: CBT_IDS.question1,
        teksSoal: "Berapakah hasil dari 15 × 8?",
        opsiA: "100",
        opsiB: "110",
        opsiC: "120",
        opsiD: "130",
        opsiE: "140",
        jawabanBenar: "C" as const,
        nomorUrut: 1,
      },
      {
        id: CBT_IDS.question2,
        teksSoal: "Jika x + 5 = 12, berapakah nilai x?",
        opsiA: "5",
        opsiB: "6",
        opsiC: "7",
        opsiD: "8",
        opsiE: "9",
        jawabanBenar: "C" as const,
        nomorUrut: 2,
      },
      {
        id: CBT_IDS.question3,
        teksSoal:
          "Sebuah persegi panjang memiliki panjang 12 cm dan lebar 5 cm. Berapakah luasnya?",
        opsiA: "50 cm²",
        opsiB: "55 cm²",
        opsiC: "60 cm²",
        opsiD: "65 cm²",
        opsiE: "70 cm²",
        jawabanBenar: "C" as const,
        nomorUrut: 3,
      },
      {
        id: CBT_IDS.question4,
        teksSoal: "Berapakah nilai dari √144?",
        opsiA: "10",
        opsiB: "11",
        opsiC: "12",
        opsiD: "13",
        opsiE: "14",
        jawabanBenar: "C" as const,
        nomorUrut: 4,
      },
      {
        id: CBT_IDS.question5,
        teksSoal:
          "Jika sebuah segitiga memiliki alas 10 cm dan tinggi 8 cm, berapakah luasnya?",
        opsiA: "30 cm²",
        opsiB: "35 cm²",
        opsiC: "40 cm²",
        opsiD: "45 cm²",
        opsiE: "80 cm²",
        jawabanBenar: "C" as const,
        nomorUrut: 5,
      },
    ];

    await db
      .insert(cbtQuestion)
      .values(
        questions.map((q) => ({
          ...q,
          tenantId: LMS_IDS.tenant,
          pelaksanaanUjianId: CBT_IDS.pelaksanaanUjian,
          mataPelajaranId: LMS_IDS.mataPelajaranMtk,
          tingkat: 10,
          kelasId: null,
          createdBy: LMS_IDS.guru1,
        })),
      )
      .onConflictDoNothing();

    // 4. Exam Session (draft, scheduled tomorrow, 90 min)
    console.log("  → Seeding cbt_exam_session...");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0); // 08:00 tomorrow

    await db
      .insert(cbtExamSession)
      .values({
        id: CBT_IDS.examSession,
        tenantId: LMS_IDS.tenant,
        pelaksanaanUjianId: CBT_IDS.pelaksanaanUjian,
        mataPelajaranId: LMS_IDS.mataPelajaranMtk,
        kelasId: LMS_IDS.kelas10A,
        proctorId: LMS_IDS.admin,
        status: "draft",
        scheduledAt: tomorrow,
        durationMinutes: 90,
        randomizeQuestions: true,
        randomizeOptions: true,
        antiCheatLevel: "standard",
        resultDetailLevel: "score_only",
        resultsReleased: false,
      })
      .onConflictDoNothing();

    // 5. Siswa Accounts (2 students with hashed default passwords)
    console.log("  → Seeding cbt_siswa_account (2 siswa)...");
    // Default password = tanggal_lahir in DDMMYYYY format
    // siswa1: 15032017 (born 2017-03-15)
    // siswa2: 22082017 (born 2017-08-22)
    const passwordHash1 = await bcrypt.hash("15032017", 10);
    const passwordHash2 = await bcrypt.hash("22082017", 10);

    await db
      .insert(cbtSiswaAccount)
      .values([
        {
          id: CBT_IDS.siswaAccount1,
          tenantId: LMS_IDS.tenant,
          siswaId: LMS_IDS.siswa1,
          nisn: "0012345001",
          passwordHash: passwordHash1,
          mustChangePassword: true,
          failedLoginAttempts: 0,
          isActive: true,
          needsReview: false,
        },
        {
          id: CBT_IDS.siswaAccount2,
          tenantId: LMS_IDS.tenant,
          siswaId: LMS_IDS.siswa2,
          nisn: "0012345002",
          passwordHash: passwordHash2,
          mustChangePassword: true,
          failedLoginAttempts: 0,
          isActive: true,
          needsReview: false,
        },
      ])
      .onConflictDoNothing();

    // ─── Summary ──────────────────────────────────────────────────────────
    console.log("");
    console.log("✅ CBT Seed completed successfully!");
    console.log("");
    console.log("📋 Summary:");
    console.log(
      "   cbt_tenant_config: 1 record (Asia/Jakarta, standard anti-cheat)",
    );
    console.log(
      "   cbt_pelaksanaan_ujian: 1 record (UTS Semester 1 - Pengetahuan, active)",
    );
    console.log(
      "   cbt_question: 5 records (Matematika, Kelas 10, pilihan ganda A-E)",
    );
    console.log(
      `   cbt_exam_session: 1 record (draft, scheduled ${tomorrow.toISOString()}, 90 min)`,
    );
    console.log("   cbt_siswa_account: 2 records");
    console.log("");
    console.log("👤 Siswa Accounts:");
    console.log("   NISN: 0012345001 | Password: 15032017 (tanggal lahir)");
    console.log("   NISN: 0012345002 | Password: 22082017 (tanggal lahir)");
    console.log("");
    console.log(
      "⚠️  Note: This seed assumes LMS tables exist with matching UUIDs.",
    );
    console.log("   Run the LMS seed first if starting from a fresh database.");
    console.log("");
  } catch (error) {
    console.error("❌ CBT Seed failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
