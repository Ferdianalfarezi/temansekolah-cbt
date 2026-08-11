/**
 * Standalone migration runner script.
 * Runs Drizzle migrations using drizzle-orm/node-postgres/migrator.
 *
 * Usage: node dist/drizzle/run-migrations.js
 *
 * This script is designed to run BEFORE the NestJS app starts,
 * typically in Railway's startCommand or as a pre-start script.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as path from "path";

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("🔄 Running database migrations...");

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1, // Single connection for migrations
  });

  try {
    const db = drizzle(pool);

    // Migrations folder path (relative to dist/)
    const migrationsFolder = path.join(__dirname, "migrations");

    await migrate(db, { migrationsFolder });

    console.log("✅ Migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
