import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, sql } from "drizzle-orm";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtPelaksanaanUjian } from "../../drizzle/schema/cbt-pelaksanaan-ujian";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { komponenPenilaian } from "../../drizzle/schema/lms-tables";
import { CreatePelaksanaanUjianDto } from "./dto/create-pelaksanaan-ujian.dto";

/** Maps periode_rapor enum to display label */
const PERIODE_DISPLAY: Record<string, string> = {
  uts_semester_1: "UTS Semester 1",
  semester_1: "Semester 1",
  uts_semester_2: "UTS Semester 2",
  semester_2: "Semester 2",
};

@Injectable()
export class PelaksanaanUjianService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  /**
   * Create a new Pelaksanaan Ujian.
   * - Queries komponen_penilaian from LMS to auto-generate the nama
   * - Checks that no other PU is currently active for this tenant
   * - Inserts with is_active=true
   * - DB unique constraint (tenant_id, tahun_ajaran_id, periode_rapor, komponen_penilaian_id) is enforced
   */
  async create(tenantId: string, dto: CreatePelaksanaanUjianDto) {
    // 1. Fetch komponen_penilaian from LMS table
    const [komponen] = await this.db
      .select({ id: komponenPenilaian.id, nama: komponenPenilaian.nama })
      .from(komponenPenilaian)
      .where(
        and(
          eq(komponenPenilaian.id, dto.komponenPenilaianId),
          eq(komponenPenilaian.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!komponen) {
      throw new NotFoundException("Komponen penilaian tidak ditemukan");
    }

    // 2. Auto-generate nama
    const periodeLabel = PERIODE_DISPLAY[dto.periodeRapor] || dto.periodeRapor;
    const nama = `${periodeLabel} - ${komponen.nama}`;

    // 3. Check if another PU is active for this tenant
    const [activePu] = await this.db
      .select({ id: cbtPelaksanaanUjian.id })
      .from(cbtPelaksanaanUjian)
      .where(
        and(
          eq(cbtPelaksanaanUjian.tenantId, tenantId),
          eq(cbtPelaksanaanUjian.isActive, true),
        ),
      )
      .limit(1);

    if (activePu) {
      throw new ConflictException(
        "Sudah ada pelaksanaan ujian aktif untuk tenant ini. Nonaktifkan terlebih dahulu sebelum membuat yang baru.",
      );
    }

    // 4. Insert
    try {
      const [created] = await this.db
        .insert(cbtPelaksanaanUjian)
        .values({
          tenantId,
          tahunAjaranId: dto.tahunAjaranId,
          periodeRapor: dto.periodeRapor,
          komponenPenilaianId: dto.komponenPenilaianId,
          nama,
          isActive: true,
        })
        .returning();

      return created;
    } catch (error: any) {
      // Handle unique constraint violation gracefully
      if (error.code === "23505") {
        throw new ConflictException(
          "Pelaksanaan ujian dengan kombinasi tahun ajaran, periode, dan komponen penilaian yang sama sudah ada.",
        );
      }
      throw error;
    }
  }

  /**
   * Deactivate a Pelaksanaan Ujian.
   * - Reject if any associated exam_session is in 'active' state
   * - Cancel all exam sessions in 'draft' or 'packaged' state
   * - Set is_active=false
   */
  async deactivate(tenantId: string, puId: string) {
    // 1. Verify PU exists and belongs to tenant
    const [pu] = await this.db
      .select()
      .from(cbtPelaksanaanUjian)
      .where(
        and(
          eq(cbtPelaksanaanUjian.id, puId),
          eq(cbtPelaksanaanUjian.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!pu) {
      throw new NotFoundException("Pelaksanaan ujian tidak ditemukan");
    }

    if (!pu.isActive) {
      throw new ConflictException("Pelaksanaan ujian sudah tidak aktif");
    }

    // 2. Check for active exam sessions
    const [activeSession] = await this.db
      .select({ id: cbtExamSession.id })
      .from(cbtExamSession)
      .where(
        and(
          eq(cbtExamSession.pelaksanaanUjianId, puId),
          eq(cbtExamSession.tenantId, tenantId),
          eq(cbtExamSession.status, "active"),
        ),
      )
      .limit(1);

    if (activeSession) {
      throw new ConflictException(
        "Tidak dapat menonaktifkan pelaksanaan ujian karena masih ada sesi ujian yang sedang berlangsung (active).",
      );
    }

    // 3. Cancel draft/packaged sessions
    await this.db
      .update(cbtExamSession)
      .set({
        status: "cancelled",
        cancellationReason: "Pelaksanaan ujian dinonaktifkan oleh admin",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(cbtExamSession.pelaksanaanUjianId, puId),
          eq(cbtExamSession.tenantId, tenantId),
          sql`${cbtExamSession.status} IN ('draft', 'packaged')`,
        ),
      );

    // 4. Deactivate PU
    const [updated] = await this.db
      .update(cbtPelaksanaanUjian)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(cbtPelaksanaanUjian.id, puId))
      .returning();

    return updated;
  }

  /**
   * List all Pelaksanaan Ujian for a tenant (active + historical).
   */
  async list(tenantId: string) {
    return this.db
      .select()
      .from(cbtPelaksanaanUjian)
      .where(eq(cbtPelaksanaanUjian.tenantId, tenantId))
      .orderBy(sql`${cbtPelaksanaanUjian.createdAt} DESC`);
  }

  /**
   * Get the single active Pelaksanaan Ujian for a tenant, or null.
   */
  async getActive(tenantId: string) {
    const [active] = await this.db
      .select()
      .from(cbtPelaksanaanUjian)
      .where(
        and(
          eq(cbtPelaksanaanUjian.tenantId, tenantId),
          eq(cbtPelaksanaanUjian.isActive, true),
        ),
      )
      .limit(1);

    return active || null;
  }

  /**
   * Get komponen_penilaian options from LMS for admin dropdown.
   */
  async getKomponenPenilaian(tenantId: string) {
    return this.db
      .select({
        id: komponenPenilaian.id,
        nama: komponenPenilaian.nama,
        tipe: komponenPenilaian.tipe,
      })
      .from(komponenPenilaian)
      .where(eq(komponenPenilaian.tenantId, tenantId))
      .orderBy(komponenPenilaian.urutan);
  }
}
