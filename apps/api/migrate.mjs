/**
 * CBT Database Migration Runner
 * Run by Railway's preDeployCommand before starting the API.
 *
 * Usage: node apps/api/migrate.mjs
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool);

console.log("🔄 Running CBT database migrations...");

try {
  await migrate(db, {
    migrationsFolder: join(__dirname, "src/drizzle/migrations"),
  });
  console.log("✅ CBT migrations completed successfully");
} catch (error) {
  console.error("❌ Migration failed:", error);
  process.exit(1);
} finally {
  await pool.end();
}
