import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, sql, desc } from "drizzle-orm";

import { DRIZZLE } from "../../drizzle/drizzle.module";
import { cbtPelaksanaanUjian } from "../../drizzle/schema/cbt-pelaksanaan-ujian";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { tahunAjaran } from "../../drizzle/schema/lms-tables";
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
   * Get active tahun ajaran from LMS for this tenant.
   */
  async getActiveTahunAjaran(tenantId: string) {
    const [active] = await this.db
      .select({
        id: tahunAjaran.id,
        nama: tahunAjaran.nama,
        tanggalMulai: tahunAjaran.tanggalMulai,
        tanggalSelesai: tahunAjaran.tanggalSelesai,
      })
      .from(tahunAjaran)
      .where(
        and(
          eq(tahunAjaran.tenantId, tenantId),
          eq(tahunAjaran.status, "aktif"),
        ),
      )
      .limit(1);

    return active || null;
  }

  /**
   * Create a new Pelaksanaan Ujian.
   * - Auto-fetches active tahun_ajaran from LMS
   * - Auto-generates the nama from periode
   * - Checks that no other PU is currently active for this tenant
   * - Inserts with is_active=true
   */
  async create(tenantId: string, dto: CreatePelaksanaanUjianDto) {
    // 1. Fetch active tahun_ajaran from LMS
    const activeTahunAjaran = await this.getActiveTahunAjaran(tenantId);

    if (!activeTahunAjaran) {
      throw new NotFoundException(
        "Tidak ada tahun ajaran aktif. Silakan aktifkan tahun ajaran di LMS terlebih dahulu.",
      );
    }

    // 2. Auto-generate nama from periode and tahun ajaran
    const periodeLabel = PERIODE_DISPLAY[dto.periodeRapor] || dto.periodeRapor;
    const nama = `${periodeLabel} - ${activeTahunAjaran.nama}`;

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

    // 4. Insert (komponenPenilaianId is nullable, set to null)
    try {
      const [created] = await this.db
        .insert(cbtPelaksanaanUjian)
        .values({
          tenantId,
          tahunAjaranId: activeTahunAjaran.id,
          periodeRapor: dto.periodeRapor,
          komponenPenilaianId: null, // No longer required
          nama,
          isActive: true,
        })
        .returning();

      return created;
    } catch (error: any) {
      // Handle unique constraint violation gracefully
      if (error.code === "23505") {
        throw new ConflictException(
          "Pelaksanaan ujian dengan kombinasi tahun ajaran dan periode yang sama sudah ada.",
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
   * List all Pelaksanaan Ujian for a tenant with optional filters.
   */
  async list(
    tenantId: string,
    filters?: {
      periodeRapor?: string;
      isActive?: boolean;
    },
  ) {
    const conditions = [eq(cbtPelaksanaanUjian.tenantId, tenantId)];

    if (filters?.periodeRapor) {
      conditions.push(
        eq(cbtPelaksanaanUjian.periodeRapor, filters.periodeRapor),
      );
    }

    if (filters?.isActive !== undefined) {
      conditions.push(eq(cbtPelaksanaanUjian.isActive, filters.isActive));
    }

    return this.db
      .select()
      .from(cbtPelaksanaanUjian)
      .where(and(...conditions))
      .orderBy(desc(cbtPelaksanaanUjian.createdAt));
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
}
