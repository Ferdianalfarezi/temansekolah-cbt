/**
 * Bulk Reset Siswa Passwords Script
 *
 * Resets all CBT siswa account passwords to their tanggal_lahir (DDMMYYYY format).
 * This is needed because the initial accounts were created with incorrect passwords.
 *
 * Usage: npx ts-node -r tsconfig-paths/register src/drizzle/reset-all-siswa-passwords.ts
 */

import { Client } from "pg";
import * as bcrypt from "bcrypt";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:kbtyvFbNFGBVWeIePJvIBqvwFdmTEhpl@tokaido.proxy.rlwy.net:44242/railway";

/**
 * Format tanggal_lahir to DDMMYYYY string for default password.
 * If tanggalLahir is null/undefined, uses "01012000" as fallback.
 */
function formatTanggalLahirPassword(tanggalLahir: string | null): string {
  if (!tanggalLahir) {
    return "01012000";
  }

  // tanggalLahir comes as "YYYY-MM-DD" from PostgreSQL date type
  const parts = tanggalLahir.split("-");
  if (parts.length !== 3) {
    return "01012000";
  }

  const [year, month, day] = parts;
  return `${day}${month}${year}`; // DDMMYYYY
}

async function resetAllPasswords() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log("🔑 Bulk Reset Siswa Passwords");
  console.log("========================================");

  // Get all siswa accounts with their tanggal_lahir from LMS
  const result = await client.query(`
    SELECT 
      csa.id,
      csa.nisn,
      s.nama,
      s.tanggal_lahir::text as tanggal_lahir
    FROM cbt_siswa_account csa
    JOIN siswa s ON s.id = csa.siswa_id
    ORDER BY csa.created_at
  `);

  console.log(`Found ${result.rows.length} accounts to reset\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const row of result.rows) {
    const defaultPassword = formatTanggalLahirPassword(row.tanggal_lahir);

    try {
      const passwordHash = await bcrypt.hash(defaultPassword, 10);

      await client.query(
        `
        UPDATE cbt_siswa_account 
        SET 
          password_hash = $1,
          must_change_password = true,
          failed_login_attempts = 0,
          locked_until = NULL,
          updated_at = NOW()
        WHERE id = $2
      `,
        [passwordHash, row.id],
      );

      console.log(
        `✅ ${row.nama} (${row.nisn}): ${row.tanggal_lahir} → ${defaultPassword}`,
      );
      successCount++;
    } catch (error: any) {
      console.error(`❌ ${row.nama} (${row.nisn}): ${error.message}`);
      errorCount++;
    }
  }

  console.log("\n========================================");
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);

  await client.end();
}

resetAllPasswords().catch((e) => {
  console.error("❌ Script failed:", e);
  process.exit(1);
});
