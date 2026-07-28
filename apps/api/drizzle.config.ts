import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/drizzle/schema/index.ts",
  out: "./src/drizzle/migrations",
  dialect: "postgresql",
  tablesFilter: ["cbt_*"], // Only manage CBT-prefixed tables; LMS tables are read-only references
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/teman_sekolah",
  },
});
