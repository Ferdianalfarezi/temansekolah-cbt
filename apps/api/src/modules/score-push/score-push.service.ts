import { Inject, Injectable, Logger } from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, sql } from "drizzle-orm";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { cbtExamParticipant } from "../../drizzle/schema/cbt-exam-participant";
import { cbtPelaksanaanUjian } from "../../drizzle/schema/cbt-pelaksanaan-ujian";
import { cbtSiswaAccount } from "../../drizzle/schema/cbt-siswa-account";
import {
  komponenPenilaian,
  rapor,
  raporNilai,
  jadwalPelajaran,
} from "../../drizzle/schema/lms-tables";
import { AuditLogService } from "../audit-log/audit-log.service";

export interface ScorePushResult {
  pushed: number;
  skipped: number;
  errors: string[];
}

interface KomponenNilaiEntry {
  komponen_penilaian_id: string;
  nilai: number;
}

@Injectable()
export class ScorePushService {
  private readonly logger = new Logger(ScorePushService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Push CBT scores to the LMS rapor_nilai table for all participants in a session.
   *
   * Flow:
   * 1. Load exam session + pelaksanaan_ujian (komponen_penilaian_id, tahun_ajaran_id, periode)
   * 2. Load komponen_penilaian to get skala_min/skala_max
   * 3. Check/create rapor record for the target kelas
   * 4. For each scored participant: scale score, upsert rapor_nilai with JSONB merge
   * 5. Log to audit log and return summary
   */
  async pushScores(
    sessionId: string,
    tenantId: string,
    actorId: string,
  ): Promise<ScorePushResult> {
    const result: ScorePushResult = { pushed: 0, skipped: 0, errors: [] };

    // 1. Load exam session
    const [session] = await this.db
      .select()
      .from(cbtExamSession)
      .where(
        and(
          eq(cbtExamSession.id, sessionId),
          eq(cbtExamSession.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!session) {
      result.errors.push(`Exam session ${sessionId} not found`);
      return result;
    }

    // Load pelaksanaan_ujian
    const [pelaksanaan] = await this.db
      .select()
      .from(cbtPelaksanaanUjian)
      .where(eq(cbtPelaksanaanUjian.id, session.pelaksanaanUjianId))
      .limit(1);

    if (!pelaksanaan) {
      result.errors.push(
        `Pelaksanaan ujian ${session.pelaksanaanUjianId} not found`,
      );
      return result;
    }

    // 2. Load komponen_penilaian for scaling
    const [komponen] = await this.db
      .select()
      .from(komponenPenilaian)
      .where(eq(komponenPenilaian.id, pelaksanaan.komponenPenilaianId))
      .limit(1);

    if (!komponen) {
      result.errors.push(
        `Komponen penilaian ${pelaksanaan.komponenPenilaianId} not found`,
      );
      return result;
    }

    const skalaMin = komponen.skalaMin ?? 0;
    const skalaMax = komponen.skalaMax ?? 100;

    // 3. Check/create rapor for target kelas
    const raporRecord = await this.getOrCreateRapor(
      tenantId,
      session.kelasId,
      pelaksanaan.tahunAjaranId,
      pelaksanaan.periodeRapor,
    );

    if (!raporRecord) {
      result.errors.push(
        `Rapor dengan status 'final' — tidak dapat push nilai`,
      );
      return result;
    }

    // 4. Load scored participants
    const participants = await this.db
      .select({
        id: cbtExamParticipant.id,
        siswaAccountId: cbtExamParticipant.siswaAccountId,
        scorePercentage: cbtExamParticipant.scorePercentage,
      })
      .from(cbtExamParticipant)
      .where(
        and(
          eq(cbtExamParticipant.examSessionId, sessionId),
          sql`${cbtExamParticipant.scorePercentage} IS NOT NULL`,
        ),
      );

    if (participants.length === 0) {
      result.skipped = 0;
      await this.logScorePush(tenantId, actorId, sessionId, result);
      return result;
    }

    // Resolve guru_id for this mapel + kelas
    const guruId = await this.resolveGuruId(
      tenantId,
      session.mataPelajaranId,
      session.kelasId,
      pelaksanaan.tahunAjaranId,
      actorId,
    );

    // Process each participant
    for (const participant of participants) {
      try {
        // Get siswa_id from siswa_account
        const [siswaAccount] = await this.db
          .select({ siswaId: cbtSiswaAccount.siswaId })
          .from(cbtSiswaAccount)
          .where(eq(cbtSiswaAccount.id, participant.siswaAccountId))
          .limit(1);

        if (!siswaAccount) {
          result.errors.push(
            `Siswa account ${participant.siswaAccountId} not found`,
          );
          result.skipped++;
          continue;
        }

        // Scale score
        const percentage = parseFloat(
          participant.scorePercentage?.toString() ?? "0",
        );
        const scaledScore = this.scaleScore(percentage, skalaMin, skalaMax);

        // Upsert rapor_nilai with JSONB merge
        await this.upsertRaporNilai(
          raporRecord.id,
          siswaAccount.siswaId,
          session.mataPelajaranId,
          tenantId,
          guruId,
          pelaksanaan.komponenPenilaianId,
          scaledScore,
        );

        result.pushed++;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        result.errors.push(
          `Failed for participant ${participant.id}: ${errMsg}`,
        );
        result.skipped++;
        this.logger.error(
          `Score push failed for participant ${participant.id}`,
          error,
        );
      }
    }

    // 5. Audit log
    await this.logScorePush(tenantId, actorId, sessionId, result);

    return result;
  }

  // ─── JSONB Merge Strategy ──────────────────────────────────────────────────

  /**
   * Upsert rapor_nilai with JSONB merge on komponen_nilai.
   *
   * Strategy (application-level merge):
   * 1. Try to find existing rapor_nilai for (rapor_id, siswa_id, mapel_id, tenant_id)
   * 2. If exists: parse komponen_nilai, find/update entry, write back
   * 3. If not exists: insert with new komponen_nilai array
   */
  private async upsertRaporNilai(
    raporId: string,
    siswaId: string,
    mataPelajaranId: string,
    tenantId: string,
    guruId: string,
    komponenPenilaianId: string,
    nilai: number,
  ): Promise<void> {
    // Check for existing record
    const [existing] = await this.db
      .select()
      .from(raporNilai)
      .where(
        and(
          eq(raporNilai.raporId, raporId),
          eq(raporNilai.siswaId, siswaId),
          eq(raporNilai.mataPelajaranId, mataPelajaranId),
          eq(raporNilai.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (existing) {
      // Application-level JSONB merge
      const komponenNilaiArray = this.parseKomponenNilai(
        existing.komponenNilai,
      );
      const updatedArray = this.mergeKomponenNilai(
        komponenNilaiArray,
        komponenPenilaianId,
        nilai,
      );

      await this.db
        .update(raporNilai)
        .set({ komponenNilai: updatedArray, guruId })
        .where(eq(raporNilai.id, existing.id));
    } else {
      // Insert new record
      const komponenNilaiArray: KomponenNilaiEntry[] = [
        { komponen_penilaian_id: komponenPenilaianId, nilai },
      ];

      await this.db.insert(raporNilai).values({
        raporId,
        siswaId,
        mataPelajaranId,
        tenantId,
        guruId,
        komponenNilai: komponenNilaiArray,
      });
    }
  }

  /**
   * Parse komponen_nilai JSONB value into typed array.
   * Handles both string (from DB) and already-parsed object.
   */
  private parseKomponenNilai(raw: unknown): KomponenNilaiEntry[] {
    if (!raw) return [];
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as KomponenNilaiEntry[];
      } catch {
        return [];
      }
    }
    if (Array.isArray(raw)) {
      return raw as KomponenNilaiEntry[];
    }
    return [];
  }

  /**
   * Merge a new score entry into the komponen_nilai array.
   * - If komponen_penilaian_id already exists → update its nilai
   * - If not → append new entry
   */
  private mergeKomponenNilai(
    existing: KomponenNilaiEntry[],
    komponenPenilaianId: string,
    nilai: number,
  ): KomponenNilaiEntry[] {
    const idx = existing.findIndex(
      (e) => e.komponen_penilaian_id === komponenPenilaianId,
    );

    if (idx >= 0) {
      // Update existing entry
      const updated = [...existing];
      updated[idx] = { ...updated[idx], nilai };
      return updated;
    }

    // Append new entry
    return [...existing, { komponen_penilaian_id: komponenPenilaianId, nilai }];
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Scale a percentage score to the komponen_penilaian's skala range.
   * Formula: skala_min + (percentage / 100) * (skala_max - skala_min)
   */
  private scaleScore(
    percentage: number,
    skalaMin: number,
    skalaMax: number,
  ): number {
    const scaled = skalaMin + (percentage / 100) * (skalaMax - skalaMin);
    return Math.round(scaled * 100) / 100; // 2 decimal places
  }

  /**
   * Get or create a rapor record for the given kelas/tahunAjaran/periode.
   * Returns null if rapor exists with status='final' (cannot modify).
   */
  private async getOrCreateRapor(
    tenantId: string,
    kelasId: string,
    tahunAjaranId: string,
    periodeRapor: string,
  ): Promise<{ id: string } | null> {
    // Check existing rapor
    const [existing] = await this.db
      .select()
      .from(rapor)
      .where(
        and(
          eq(rapor.tenantId, tenantId),
          eq(rapor.kelasId, kelasId),
          eq(rapor.tahunAjaranId, tahunAjaranId),
          eq(rapor.periode, periodeRapor as any),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.status === "final") {
        return null; // Cannot push to finalized rapor
      }
      return { id: existing.id };
    }

    // Create draft rapor
    const [newRapor] = await this.db
      .insert(rapor)
      .values({
        tenantId,
        kelasId,
        tahunAjaranId,
        periode: periodeRapor as any,
        status: "draft",
      })
      .returning({ id: rapor.id });

    return { id: newRapor.id };
  }

  /**
   * Resolve guru_id from jadwal_pelajaran for this mapel + kelas.
   * Fallback: use the requesting admin's ID.
   */
  private async resolveGuruId(
    tenantId: string,
    mataPelajaranId: string,
    kelasId: string,
    tahunAjaranId: string,
    fallbackActorId: string,
  ): Promise<string> {
    const [jadwal] = await this.db
      .select({ guruId: jadwalPelajaran.guruId })
      .from(jadwalPelajaran)
      .where(
        and(
          eq(jadwalPelajaran.tenantId, tenantId),
          eq(jadwalPelajaran.mataPelajaranId, mataPelajaranId),
          eq(jadwalPelajaran.kelasId, kelasId),
          eq(jadwalPelajaran.tahunAjaranId, tahunAjaranId),
        ),
      )
      .limit(1);

    return jadwal?.guruId ?? fallbackActorId;
  }

  // ─── Audit Logging ─────────────────────────────────────────────────────────

  /**
   * Log the score push operation to the audit log.
   */
  private async logScorePush(
    tenantId: string,
    actorId: string,
    sessionId: string,
    result: ScorePushResult,
  ): Promise<void> {
    await this.auditLogService.log({
      tenantId,
      actorId,
      actorType: "staff",
      actorRole: "admin",
      action: "create",
      resourceType: "score_push",
      resourceId: sessionId,
      metadata: {
        pushed: result.pushed,
        skipped: result.skipped,
        errors: result.errors,
      },
    });
  }
}
