-- Migration: Simplify Pelaksanaan Ujian constraint and make komponenPenilaianId nullable
-- 
-- Changes:
-- 1. Drop old unique constraint (tenant + tahun_ajaran + periode + komponen)
-- 2. Create new unique constraint (tenant + tahun_ajaran + periode) - komponen no longer included
-- 3. Make komponen_penilaian_id column nullable

-- Step 1: Drop the old unique constraint
ALTER TABLE "cbt_pelaksanaan_ujian" 
DROP CONSTRAINT IF EXISTS "uq_cbt_pu_tenant_periode_komponen";

--> statement-breakpoint

-- Step 2: Make komponen_penilaian_id nullable (it was NOT NULL before)
ALTER TABLE "cbt_pelaksanaan_ujian" 
ALTER COLUMN "komponen_penilaian_id" DROP NOT NULL;

--> statement-breakpoint

-- Step 3: Add the new unique constraint (without komponen_penilaian_id)
ALTER TABLE "cbt_pelaksanaan_ujian"
ADD CONSTRAINT "uq_cbt_pu_tenant_periode" 
UNIQUE ("tenant_id", "tahun_ajaran_id", "periode_rapor");
