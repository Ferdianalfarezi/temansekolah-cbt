/**
 * CBT Teman Sekolah — Bank Soal Migration Script
 *
 * Migrates existing cbt_question records to the new Bank Soal structure.
 * Creates cbt_bank_soal records for each unique combination of:
 * (pelaksanaan_ujian_id, mata_pelajaran_id, tingkat, kelas_id)
 *
 * This script is IDEMPOTENT: only processes questions where bank_soal_id IS NULL.
 * Can be re-run safely multiple times.
 *
 * Usage: pnpm --filter @cbt/api db:migrate-bank-soal
 *
 * Requirements covered: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql, eq, and, isNull } from "drizzle-orm";

import { cbtBankSoal } from "../schema/cbt-bank-soal";
import { cbtBankSoalKelas } from "../schema/cbt-bank-soal-kelas";
import { cbtQuestion } from "../schema/cbt-question";
import { mataPelajaran, kelas } from "../schema/lms-tables";

interface UniqueCombination {
  pelaksanaan_ujian_id: string;
  tenant_id: string;
  mata_pelajaran_id: string | null;
  tingkat: number | null;
  kelas_id: string | null;
  created_by: string;
  [key: string]: unknown; // Index signature for drizzle execute
}

async function migrateToBankSoal() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is not set");
    console.error("   Create a .env file or set it in your shell.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  console.log("🚀 Bank Soal Migration: Starting...\n");

  try {
    // Get all unique combinations of (pelaksanaan_ujian_id, mata_pelajaran_id, tingkat, kelas_id)
    // from cbt_question where bank_soal_id IS NULL
    console.log(
      "  → Finding unique question combinations without bank_soal_id...",
    );

    const uniqueCombinations = await db.execute<UniqueCombination>(sql`
      SELECT DISTINCT 
        pelaksanaan_ujian_id,
        tenant_id,
        mata_pelajaran_id,
        tingkat,
        kelas_id,
        created_by
      FROM cbt_question
      WHERE bank_soal_id IS NULL
    `);

    if (uniqueCombinations.rows.length === 0) {
      console.log("\n✅ No questions need migration (all have bank_soal_id).");
      console.log("   Migration script is idempotent - nothing to do.\n");
      await pool.end();
      return { bankSoalCount: 0, questionCount: 0 };
    }

    console.log(
      `  → Found ${uniqueCombinations.rows.length} unique combination(s) to migrate.\n`,
    );

    let bankSoalCount = 0;
    let questionCount = 0;

    for (const combo of uniqueCombinations.rows) {
      // Skip if mata_pelajaran_id is null (can't create valid bank soal)
      if (!combo.mata_pelajaran_id) {
        console.log(`  ⚠️  Skipping combination with null mata_pelajaran_id`);
        continue;
      }

      // Get mata pelajaran name for default naming
      const mapelResult = await db
        .select({ nama: mataPelajaran.nama })
        .from(mataPelajaran)
        .where(eq(mataPelajaran.id, combo.mata_pelajaran_id))
        .limit(1);

      const mapelNama = mapelResult[0]?.nama ?? "Unknown";

      // Generate default name based on whether kelas_id or tingkat is used
      let bankSoalNama: string;
      if (combo.kelas_id) {
        const kelasResult = await db
          .select({ nama: kelas.nama })
          .from(kelas)
          .where(eq(kelas.id, combo.kelas_id))
          .limit(1);
        bankSoalNama = `Bank Soal ${mapelNama} - ${kelasResult[0]?.nama ?? "Kelas"}`;
      } else if (combo.tingkat) {
        bankSoalNama = `Bank Soal ${mapelNama} - Tingkat ${combo.tingkat}`;
      } else {
        // Fallback when neither kelas_id nor tingkat is set
        bankSoalNama = `Bank Soal ${mapelNama}`;
      }

      console.log(`  → Creating: "${bankSoalNama}"...`);

      // Create Bank Soal with default values per Requirement 8.4
      const insertedBankSoal = await db
        .insert(cbtBankSoal)
        .values({
          tenantId: combo.tenant_id,
          pelaksanaanUjianId: combo.pelaksanaan_ujian_id,
          mataPelajaranId: combo.mata_pelajaran_id,
          createdBy: combo.created_by,
          nama: bankSoalNama,
          tingkat: combo.tingkat,
          durasiMenit: 60, // Default per Requirement 8.4
          kkm: 70, // Default per Requirement 8.4
          status: "draft",
        })
        .returning({ id: cbtBankSoal.id });

      const bankSoalId = insertedBankSoal[0].id;
      bankSoalCount++;

      // If kelas-specific, add entry to junction table
      if (combo.kelas_id) {
        await db.insert(cbtBankSoalKelas).values({
          bankSoalId: bankSoalId,
          kelasId: combo.kelas_id,
        });
      }

      // Update all matching questions with the new bank_soal_id
      // Build WHERE conditions dynamically to handle NULL values correctly
      const whereConditions = [
        eq(cbtQuestion.pelaksanaanUjianId, combo.pelaksanaan_ujian_id),
        eq(cbtQuestion.mataPelajaranId, combo.mata_pelajaran_id),
        isNull(cbtQuestion.bankSoalId),
      ];

      // Handle NULL tingkat
      if (combo.tingkat !== null) {
        whereConditions.push(eq(cbtQuestion.tingkat, combo.tingkat));
      } else {
        whereConditions.push(isNull(cbtQuestion.tingkat));
      }

      // Handle NULL kelas_id
      if (combo.kelas_id !== null) {
        whereConditions.push(eq(cbtQuestion.kelasId, combo.kelas_id));
      } else {
        whereConditions.push(isNull(cbtQuestion.kelasId));
      }

      const updateResult = await db
        .update(cbtQuestion)
        .set({ bankSoalId: bankSoalId })
        .where(and(...whereConditions));

      const updatedCount = updateResult.rowCount ?? 0;
      questionCount += updatedCount;

      console.log(
        `     ✓ Updated ${updatedCount} question(s) with bank_soal_id`,
      );
    }

    // Log final results per Requirement 8.5
    console.log("\n" + "=".repeat(60));
    console.log(`✅ Migration complete!`);
    console.log(`   ${bankSoalCount} bank soal created`);
    console.log(`   ${questionCount} questions updated`);
    console.log("=".repeat(60) + "\n");

    await pool.end();
    return { bankSoalCount, questionCount };
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    await pool.end();
    process.exit(1);
  }
}

// Run migration when executed directly
migrateToBankSoal();

export { migrateToBankSoal };
