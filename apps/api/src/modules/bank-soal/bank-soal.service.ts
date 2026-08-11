import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, asc, count, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { CbtRole } from "@/common/enums";
import { DRIZZLE } from "../../drizzle/drizzle.module";
import {
  jadwalPelajaran,
  kelas,
  mataPelajaran,
  user,
} from "../../drizzle/schema/lms-tables";
import { cbtExamSession } from "../../drizzle/schema/cbt-exam-session";
import { cbtExamSessionQuestion } from "../../drizzle/schema/cbt-exam-session-question";
import { cbtQuestion } from "../../drizzle/schema/cbt-question";
import { cbtBankSoal } from "../../drizzle/schema/cbt-bank-soal";
import { cbtBankSoalKelas } from "../../drizzle/schema/cbt-bank-soal-kelas";
import { cbtPelaksanaanUjian } from "../../drizzle/schema/cbt-pelaksanaan-ujian";
import { cbtAuditLog } from "../../drizzle/schema/cbt-audit-log";
import {
  CreateBankSoalDto,
  CreateSoalDto,
  ListBankSoalQueryDto,
  ScheduleExamDto,
  UpdateBankSoalDto,
  UpdateSoalDto,
} from "./dto";

/**
 * Represents the scope of mata pelajaran and kelas that a Guru can access
 * based on their jadwal_pelajaran assignments.
 */
export interface GuruScope {
  mataPelajaranIds: string[];
  kelasIds: string[];
}

/**
 * Response type for bank soal list items
 */
export interface BankSoalListItem {
  id: string;
  nama: string;
  mataPelajaranId: string;
  mataPelajaranNama: string | null;
  tingkat: number | null;
  durasiMenit: number;
  kkm: number;
  status: "draft" | "ready" | "archived";
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  soalCount: number;
  targetKelas: string[];
  targetKelasIds: string[];
  createdAt: Date;
  createdBy: string;
}

/**
 * Response type for paginated bank soal list
 */
export interface BankSoalListResponse {
  data: BankSoalListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Response type for bank soal detail with soal list
 */
export interface BankSoalDetail extends BankSoalListItem {
  isLocked: boolean;
  soal: Array<{
    id: string;
    teksSoal: string;
    gambarSoalUrl: string | null;
    opsiA: string;
    gambarAUrl: string | null;
    opsiB: string;
    gambarBUrl: string | null;
    opsiC: string;
    gambarCUrl: string | null;
    opsiD: string;
    gambarDUrl: string | null;
    opsiE: string | null;
    gambarEUrl: string | null;
    jawabanBenar: string;
    nomorUrut: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

/**
 * Locked statuses - bank soal cannot be edited/deleted if used in sessions with these statuses
 */
const LOCKED_STATUSES = ["packaged", "active", "completed"] as const;

/**
 * Parsed soal row from Excel
 */
export interface ParsedSoalRow {
  nomorSoal: number;
  teksSoal: string;
  jawabanBenar: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  opsiD: string;
  opsiE: string | null;
}

/**
 * Validation error for a specific row
 */
export interface ImportRowError {
  row: number;
  errors: string[];
}

/**
 * Result of parsing an Excel file for import
 */
export interface ImportParseResult {
  validRows: ParsedSoalRow[];
  errors: ImportRowError[];
  totalRows: number;
}

/**
 * Result of bulk import operation
 */
export interface ImportResult {
  importedCount: number;
  errors: ImportRowError[];
  totalRows: number;
}

@Injectable()
export class BankSoalService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  /**
   * Check if the user has admin role (admin_sekolah or superadmin).
   * Admins bypass guru scope restrictions and have full access.
   */
  private isAdmin(cbtRole: CbtRole): boolean {
    return cbtRole === CbtRole.ADMIN_SEKOLAH || cbtRole === CbtRole.SUPERADMIN;
  }

  /**
   * Get mata pelajaran and kelas options for the current user's scope.
   * - Admin: Returns all mata pelajaran and kelas in tenant
   * - Guru: Returns only mata pelajaran and kelas from their jadwal_pelajaran
   *
   * @param tenantId - The tenant ID
   * @param userId - The user's ID
   * @param cbtRole - The user's CBT role
   * @returns Object with mataPelajaran and kelas arrays
   */
  async getScope(
    tenantId: string,
    userId: string,
    cbtRole: CbtRole,
  ): Promise<{
    mataPelajaran: Array<{ id: string; nama: string }>;
    kelas: Array<{ id: string; nama: string; tingkat: number }>;
  }> {
    if (this.isAdmin(cbtRole)) {
      // Admin: return all mata pelajaran and kelas in tenant
      const [allMataPelajaran, allKelas] = await Promise.all([
        this.db
          .select({
            id: mataPelajaran.id,
            nama: mataPelajaran.nama,
          })
          .from(mataPelajaran)
          .where(eq(mataPelajaran.tenantId, tenantId))
          .orderBy(mataPelajaran.nama),
        this.db
          .select({
            id: kelas.id,
            nama: kelas.nama,
            tingkat: kelas.tingkat,
          })
          .from(kelas)
          .where(eq(kelas.tenantId, tenantId))
          .orderBy(kelas.tingkat, kelas.nama),
      ]);

      return {
        mataPelajaran: allMataPelajaran,
        kelas: allKelas,
      };
    }

    // Guru: return only what they teach
    const scope = await this.getGuruScope(userId, tenantId);

    if (scope.mataPelajaranIds.length === 0 && scope.kelasIds.length === 0) {
      return { mataPelajaran: [], kelas: [] };
    }

    const [scopedMataPelajaran, scopedKelas] = await Promise.all([
      scope.mataPelajaranIds.length > 0
        ? this.db
            .select({
              id: mataPelajaran.id,
              nama: mataPelajaran.nama,
            })
            .from(mataPelajaran)
            .where(
              and(
                eq(mataPelajaran.tenantId, tenantId),
                inArray(mataPelajaran.id, scope.mataPelajaranIds),
              ),
            )
            .orderBy(mataPelajaran.nama)
        : Promise.resolve([]),
      scope.kelasIds.length > 0
        ? this.db
            .select({
              id: kelas.id,
              nama: kelas.nama,
              tingkat: kelas.tingkat,
            })
            .from(kelas)
            .where(
              and(
                eq(kelas.tenantId, tenantId),
                inArray(kelas.id, scope.kelasIds),
              ),
            )
            .orderBy(kelas.tingkat, kelas.nama)
        : Promise.resolve([]),
    ]);

    return {
      mataPelajaran: scopedMataPelajaran,
      kelas: scopedKelas,
    };
  }

  /**
   * Get users who can be proctors (staff with admin or guru role).
   * Returns users from the LMS user table who belong to this tenant.
   *
   * @param tenantId - The tenant ID
   * @returns Array of users with id and nama
   */
  async getProctorOptions(
    tenantId: string,
  ): Promise<Array<{ id: string; nama: string }>> {
    // Get active users in this tenant with admin or guru roles
    const users = await this.db
      .select({
        id: user.id,
        nama: user.nama,
      })
      .from(user)
      .where(
        and(
          eq(user.tenantId, tenantId),
          eq(user.isActive, true),
          sql`${user.role} IN ('admin', 'guru', 'kepala_sekolah')`,
        ),
      )
      .orderBy(user.nama);

    return users.filter((u) => u.nama !== null) as Array<{
      id: string;
      nama: string;
    }>;
  }

  /**
   * Get the scope of mata pelajaran and kelas that a Guru can access.
   * This is derived from the guru's jadwal_pelajaran assignments.
   *
   * @param userId - The guru's user ID
   * @param tenantId - The tenant ID
   * @returns GuruScope with distinct mataPelajaranIds and kelasIds
   *
   * _Requirements: 1.2, 1.3, 9.1_
   */
  async getGuruScope(userId: string, tenantId: string): Promise<GuruScope> {
    // Query jadwal_pelajaran to get all mata pelajaran and kelas taught by this guru
    const schedules = await this.db
      .select({
        mataPelajaranId: jadwalPelajaran.mataPelajaranId,
        kelasId: jadwalPelajaran.kelasId,
      })
      .from(jadwalPelajaran)
      .where(
        and(
          eq(jadwalPelajaran.guruId, userId),
          eq(jadwalPelajaran.tenantId, tenantId),
        ),
      );

    // Extract distinct IDs, filtering out nulls
    const mataPelajaranIds = [
      ...new Set(
        schedules
          .map((s) => s.mataPelajaranId)
          .filter((id): id is string => id !== null),
      ),
    ];

    const kelasIds = [
      ...new Set(
        schedules
          .map((s) => s.kelasId)
          .filter((id): id is string => id !== null),
      ),
    ];

    return { mataPelajaranIds, kelasIds };
  }

  /**
   * Validate that a Guru has access to the specified mata pelajaran and kelas.
   * Throws ForbiddenException if the guru doesn't have access.
   *
   * @param userId - The guru's user ID
   * @param tenantId - The tenant ID
   * @param mataPelajaranId - The mata pelajaran to validate access for
   * @param kelasIds - Optional array of kelas IDs to validate access for
   * @throws ForbiddenException if guru doesn't have access to the mata pelajaran or any of the kelas
   *
   * _Requirements: 9.2, 9.3_
   */
  async validateGuruScope(
    userId: string,
    tenantId: string,
    mataPelajaranId: string,
    kelasIds?: string[],
  ): Promise<void> {
    const scope = await this.getGuruScope(userId, tenantId);

    // Check mata pelajaran access
    if (!scope.mataPelajaranIds.includes(mataPelajaranId)) {
      throw new ForbiddenException(
        "Anda tidak memiliki akses ke mata pelajaran ini",
      );
    }

    // Check kelas access if kelasIds provided
    if (kelasIds && kelasIds.length > 0) {
      const unauthorizedKelas = kelasIds.filter(
        (id) => !scope.kelasIds.includes(id),
      );
      if (unauthorizedKelas.length > 0) {
        throw new ForbiddenException("Anda tidak memiliki akses ke kelas ini");
      }
    }
  }

  /**
   * Check if a bank soal is locked (cannot be edited/deleted).
   * A bank soal is locked if any of its questions are used in an exam session
   * with status 'packaged', 'active', or 'completed'.
   *
   * @param bankSoalId - The bank soal ID to check
   * @returns true if the bank soal is locked, false otherwise
   *
   * _Requirements: 2.9, 5.4_
   */
  async checkBankSoalLocked(bankSoalId: string): Promise<boolean> {
    // Find questions belonging to this bank soal
    const questions = await this.db
      .select({ id: cbtQuestion.id })
      .from(cbtQuestion)
      .where(eq(cbtQuestion.bankSoalId, bankSoalId));

    if (questions.length === 0) {
      return false;
    }

    const questionIds = questions.map((q) => q.id);

    // Check if any of these questions are used in locked exam sessions
    const [lockedSession] = await this.db
      .select({ id: cbtExamSession.id })
      .from(cbtExamSession)
      .innerJoin(
        cbtExamSessionQuestion,
        eq(cbtExamSession.id, cbtExamSessionQuestion.examSessionId),
      )
      .where(
        and(
          inArray(cbtExamSessionQuestion.questionId, questionIds),
          sql`${cbtExamSession.status} IN ('packaged', 'active', 'completed')`,
        ),
      )
      .limit(1);

    return !!lockedSession;
  }

  /**
   * Check if a bank soal is used in any exam session (regardless of status).
   * This is used for delete protection - a bank soal cannot be deleted if used anywhere.
   *
   * @param bankSoalId - The bank soal ID to check
   * @returns true if the bank soal is used in any session, false otherwise
   *
   * _Requirements: 6.3_
   */
  async checkBankSoalUsedInAnySession(bankSoalId: string): Promise<boolean> {
    // Find questions belonging to this bank soal
    const questions = await this.db
      .select({ id: cbtQuestion.id })
      .from(cbtQuestion)
      .where(eq(cbtQuestion.bankSoalId, bankSoalId));

    if (questions.length === 0) {
      return false;
    }

    const questionIds = questions.map((q) => q.id);

    // Check if any of these questions are used in ANY exam session
    const [usedSession] = await this.db
      .select({ id: cbtExamSessionQuestion.id })
      .from(cbtExamSessionQuestion)
      .where(inArray(cbtExamSessionQuestion.questionId, questionIds))
      .limit(1);

    return !!usedSession;
  }

  // ==================== CRUD Operations ====================
  // Implemented in Tasks 3.4, 3.7, 3.9, 3.11

  /**
   * Create a new Bank Soal
   *
   * @param tenantId - The tenant ID
   * @param userId - The user's ID
   * @param cbtRole - The user's CBT role
   * @param dto - The CreateBankSoalDto with bank soal details
   * @returns The created Bank Soal record
   * @throws NotFoundException if no active pelaksanaan ujian
   * @throws ForbiddenException if guru doesn't have access to mata pelajaran or kelas
   *
   * _Requirements: 1.1, 1.4, 1.5, 1.8, 1.9_
   */
  async create(
    tenantId: string,
    userId: string,
    cbtRole: CbtRole,
    dto: CreateBankSoalDto,
  ): Promise<typeof cbtBankSoal.$inferSelect> {
    // 1. Get active pelaksanaan_ujian for tenant
    const [activePu] = await this.db
      .select()
      .from(cbtPelaksanaanUjian)
      .where(
        and(
          eq(cbtPelaksanaanUjian.tenantId, tenantId),
          eq(cbtPelaksanaanUjian.isActive, true),
        ),
      )
      .limit(1);

    if (!activePu) {
      throw new NotFoundException(
        "Tidak ada pelaksanaan ujian aktif. Hubungi admin.",
      );
    }

    // 2. Validate scope for mataPelajaranId (only for guru, admins bypass)
    if (!this.isAdmin(cbtRole)) {
      await this.validateGuruScope(userId, tenantId, dto.mataPelajaranId);

      // 3. Validate guru scope for targetKelasIds (if provided)
      if (dto.targetKelasIds && dto.targetKelasIds.length > 0) {
        await this.validateGuruScope(
          userId,
          tenantId,
          dto.mataPelajaranId,
          dto.targetKelasIds,
        );
      }
    }

    // 4. Handle tingkat vs targetKelasIds precedence
    // If both provided, targetKelasIds wins and tingkat is ignored
    const tingkatValue =
      dto.targetKelasIds && dto.targetKelasIds.length > 0
        ? null
        : (dto.tingkat ?? null);

    // 5. Insert bank soal with transaction (for atomicity with junction table)
    const [bankSoal] = await this.db.transaction(async (tx) => {
      // Insert cbt_bank_soal
      const [created] = await tx
        .insert(cbtBankSoal)
        .values({
          tenantId,
          pelaksanaanUjianId: activePu.id,
          mataPelajaranId: dto.mataPelajaranId,
          createdBy: userId,
          nama: dto.nama,
          tingkat: tingkatValue,
          durasiMenit: dto.durasiMenit,
          kkm: dto.kkm,
          shuffleQuestions: dto.shuffleQuestions ?? false,
          shuffleOptions: dto.shuffleOptions ?? false,
          status: "draft",
        })
        .returning();

      // 6. Insert cbt_bank_soal_kelas for each targetKelasId
      if (dto.targetKelasIds && dto.targetKelasIds.length > 0) {
        await tx.insert(cbtBankSoalKelas).values(
          dto.targetKelasIds.map((kelasId) => ({
            bankSoalId: created.id,
            kelasId,
          })),
        );
      }

      return [created];
    });

    return bankSoal;
  }

  /**
   * List Bank Soal with filters and pagination
   *
   * @param tenantId - The tenant ID
   * @param userId - The user's ID
   * @param cbtRole - The user's CBT role
   * @param query - Filter and pagination parameters
   * @returns Paginated list of bank soal with soal count and target kelas
   *
   * _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
   */
  async findAll(
    tenantId: string,
    userId: string,
    cbtRole: CbtRole,
    query: ListBankSoalQueryDto,
  ): Promise<BankSoalListResponse> {
    // 1. Get active pelaksanaan ujian for tenant
    const [activePu] = await this.db
      .select()
      .from(cbtPelaksanaanUjian)
      .where(
        and(
          eq(cbtPelaksanaanUjian.tenantId, tenantId),
          eq(cbtPelaksanaanUjian.isActive, true),
        ),
      )
      .limit(1);

    if (!activePu) {
      // Return empty result if no active pelaksanaan ujian
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      return {
        data: [],
        meta: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
    }

    // 2. Build base conditions
    const baseConditions = [
      eq(cbtBankSoal.tenantId, tenantId),
      eq(cbtBankSoal.pelaksanaanUjianId, activePu.id),
    ];

    // 3. Scope filter: admin sees all, guru sees their scope + own creations
    if (!this.isAdmin(cbtRole)) {
      const scope = await this.getGuruScope(userId, tenantId);
      if (scope.mataPelajaranIds.length > 0) {
        baseConditions.push(
          or(
            inArray(cbtBankSoal.mataPelajaranId, scope.mataPelajaranIds),
            eq(cbtBankSoal.createdBy, userId),
          )!,
        );
      } else {
        // If guru has no jadwal pelajaran, only show their own created bank soal
        baseConditions.push(eq(cbtBankSoal.createdBy, userId));
      }
    }
    // Admin: no scope filter, sees all bank soal in tenant

    // 4. Apply optional filters
    if (query.mataPelajaranId) {
      baseConditions.push(
        eq(cbtBankSoal.mataPelajaranId, query.mataPelajaranId),
      );
    }

    if (query.tingkat) {
      baseConditions.push(eq(cbtBankSoal.tingkat, query.tingkat));
    }

    if (query.search) {
      baseConditions.push(ilike(cbtBankSoal.nama, `%${query.search}%`));
    }

    // 5. Count total for pagination
    const [countResult] = await this.db
      .select({ count: count() })
      .from(cbtBankSoal)
      .where(and(...baseConditions));

    const total = countResult?.count ?? 0;

    // 6. Get paginated bank soal with mata pelajaran name
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const bankSoalList = await this.db
      .select({
        id: cbtBankSoal.id,
        nama: cbtBankSoal.nama,
        mataPelajaranId: cbtBankSoal.mataPelajaranId,
        mataPelajaranNama: mataPelajaran.nama,
        tingkat: cbtBankSoal.tingkat,
        durasiMenit: cbtBankSoal.durasiMenit,
        kkm: cbtBankSoal.kkm,
        status: cbtBankSoal.status,
        shuffleQuestions: cbtBankSoal.shuffleQuestions,
        shuffleOptions: cbtBankSoal.shuffleOptions,
        createdAt: cbtBankSoal.createdAt,
        createdBy: cbtBankSoal.createdBy,
      })
      .from(cbtBankSoal)
      .leftJoin(
        mataPelajaran,
        eq(cbtBankSoal.mataPelajaranId, mataPelajaran.id),
      )
      .where(and(...baseConditions))
      .orderBy(cbtBankSoal.createdAt)
      .limit(limit)
      .offset(offset);

    // 7. Get soal count for each bank soal
    const bankSoalIds = bankSoalList.map((bs) => bs.id);

    let soalCounts: Record<string, number> = {};
    if (bankSoalIds.length > 0) {
      const soalCountResults = await this.db
        .select({
          bankSoalId: cbtQuestion.bankSoalId,
          count: count(),
        })
        .from(cbtQuestion)
        .where(inArray(cbtQuestion.bankSoalId, bankSoalIds))
        .groupBy(cbtQuestion.bankSoalId);

      soalCounts = soalCountResults.reduce(
        (acc, row) => {
          if (row.bankSoalId) {
            acc[row.bankSoalId] = row.count;
          }
          return acc;
        },
        {} as Record<string, number>,
      );
    }

    // 9. Get target kelas for each bank soal
    let targetKelasMap: Record<string, { id: string; nama: string }[]> = {};
    if (bankSoalIds.length > 0) {
      const targetKelasResults = await this.db
        .select({
          bankSoalId: cbtBankSoalKelas.bankSoalId,
          kelasId: cbtBankSoalKelas.kelasId,
          kelasNama: kelas.nama,
        })
        .from(cbtBankSoalKelas)
        .leftJoin(kelas, eq(cbtBankSoalKelas.kelasId, kelas.id))
        .where(inArray(cbtBankSoalKelas.bankSoalId, bankSoalIds));

      targetKelasMap = targetKelasResults.reduce(
        (acc, row) => {
          if (!acc[row.bankSoalId]) {
            acc[row.bankSoalId] = [];
          }
          acc[row.bankSoalId].push({
            id: row.kelasId,
            nama: row.kelasNama ?? "",
          });
          return acc;
        },
        {} as Record<string, { id: string; nama: string }[]>,
      );
    }

    // 10. Build response
    const data: BankSoalListItem[] = bankSoalList.map((bs) => ({
      id: bs.id,
      nama: bs.nama,
      mataPelajaranId: bs.mataPelajaranId,
      mataPelajaranNama: bs.mataPelajaranNama,
      tingkat: bs.tingkat,
      durasiMenit: bs.durasiMenit,
      kkm: bs.kkm,
      status: bs.status,
      shuffleQuestions: bs.shuffleQuestions,
      shuffleOptions: bs.shuffleOptions,
      soalCount: soalCounts[bs.id] ?? 0,
      // Return both formats for frontend compatibility
      targetKelas: (targetKelasMap[bs.id] ?? []).map((k) => k.nama),
      targetKelasIds: (targetKelasMap[bs.id] ?? []).map((k) => k.id),
      createdAt: bs.createdAt,
      createdBy: bs.createdBy,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get Bank Soal detail with all soal
   *
   * @param tenantId - The tenant ID
   * @param userId - The user's ID
   * @param cbtRole - The user's CBT role
   * @param id - The bank soal ID
   * @returns Bank soal detail with soal list, target kelas, and lock status
   * @throws NotFoundException if bank soal not found
   * @throws ForbiddenException if guru doesn't have access
   *
   * _Requirements: 4.1, 4.2, 9.4, 9.5_
   */
  async findOne(
    tenantId: string,
    userId: string,
    cbtRole: CbtRole,
    id: string,
  ): Promise<BankSoalDetail> {
    // 1. Get bank soal with mata pelajaran name
    const [bankSoalResult] = await this.db
      .select({
        id: cbtBankSoal.id,
        nama: cbtBankSoal.nama,
        mataPelajaranId: cbtBankSoal.mataPelajaranId,
        mataPelajaranNama: mataPelajaran.nama,
        tingkat: cbtBankSoal.tingkat,
        durasiMenit: cbtBankSoal.durasiMenit,
        kkm: cbtBankSoal.kkm,
        status: cbtBankSoal.status,
        shuffleQuestions: cbtBankSoal.shuffleQuestions,
        shuffleOptions: cbtBankSoal.shuffleOptions,
        createdAt: cbtBankSoal.createdAt,
        createdBy: cbtBankSoal.createdBy,
      })
      .from(cbtBankSoal)
      .leftJoin(
        mataPelajaran,
        eq(cbtBankSoal.mataPelajaranId, mataPelajaran.id),
      )
      .where(and(eq(cbtBankSoal.id, id), eq(cbtBankSoal.tenantId, tenantId)))
      .limit(1);

    if (!bankSoalResult) {
      throw new NotFoundException("Bank soal tidak ditemukan");
    }

    // 2. Validate access (admin has full access, guru needs scope check)
    if (!this.isAdmin(cbtRole)) {
      const scope = await this.getGuruScope(userId, tenantId);
      const hasMapelAccess = scope.mataPelajaranIds.includes(
        bankSoalResult.mataPelajaranId,
      );
      const isCreator = bankSoalResult.createdBy === userId;

      if (!hasMapelAccess && !isCreator) {
        throw new ForbiddenException(
          "Anda tidak memiliki akses ke bank soal ini",
        );
      }
    }

    // 3. Get all soal ordered by nomorUrut
    const soalList = await this.db
      .select({
        id: cbtQuestion.id,
        teksSoal: cbtQuestion.teksSoal,
        gambarSoalUrl: cbtQuestion.gambarSoalUrl,
        opsiA: cbtQuestion.opsiA,
        gambarAUrl: cbtQuestion.gambarAUrl,
        opsiB: cbtQuestion.opsiB,
        gambarBUrl: cbtQuestion.gambarBUrl,
        opsiC: cbtQuestion.opsiC,
        gambarCUrl: cbtQuestion.gambarCUrl,
        opsiD: cbtQuestion.opsiD,
        gambarDUrl: cbtQuestion.gambarDUrl,
        opsiE: cbtQuestion.opsiE,
        gambarEUrl: cbtQuestion.gambarEUrl,
        jawabanBenar: cbtQuestion.jawabanBenar,
        nomorUrut: cbtQuestion.nomorUrut,
        createdAt: cbtQuestion.createdAt,
        updatedAt: cbtQuestion.updatedAt,
      })
      .from(cbtQuestion)
      .where(eq(cbtQuestion.bankSoalId, id))
      .orderBy(asc(cbtQuestion.nomorUrut));

    // 4. Get target kelas
    const targetKelasResults = await this.db
      .select({
        kelasId: cbtBankSoalKelas.kelasId,
        kelasNama: kelas.nama,
      })
      .from(cbtBankSoalKelas)
      .leftJoin(kelas, eq(cbtBankSoalKelas.kelasId, kelas.id))
      .where(eq(cbtBankSoalKelas.bankSoalId, id));

    // Extract both kelas names (for display) and IDs (for form binding)
    const targetKelas = targetKelasResults.map((tk) => tk.kelasNama ?? "");
    const targetKelasIds = targetKelasResults.map((tk) => tk.kelasId);

    // 5. Check lock status
    const isLocked = await this.checkBankSoalLocked(id);

    // 6. Build response
    return {
      id: bankSoalResult.id,
      nama: bankSoalResult.nama,
      mataPelajaranId: bankSoalResult.mataPelajaranId,
      mataPelajaranNama: bankSoalResult.mataPelajaranNama,
      tingkat: bankSoalResult.tingkat,
      durasiMenit: bankSoalResult.durasiMenit,
      kkm: bankSoalResult.kkm,
      status: bankSoalResult.status,
      shuffleQuestions: bankSoalResult.shuffleQuestions,
      shuffleOptions: bankSoalResult.shuffleOptions,
      soalCount: soalList.length,
      targetKelas,
      targetKelasIds,
      createdAt: bankSoalResult.createdAt,
      createdBy: bankSoalResult.createdBy,
      isLocked,
      soal: soalList,
    };
  }

  /**
   * Update Bank Soal settings
   *
   * @param tenantId - The tenant ID
   * @param userId - The user's ID
   * @param cbtRole - The user's CBT role
   * @param id - The bank soal ID
   * @param dto - The UpdateBankSoalDto with fields to update
   * @returns The updated Bank Soal record
   * @throws NotFoundException if bank soal not found
   * @throws ForbiddenException if guru doesn't have access
   * @throws ConflictException if bank soal is locked
   *
   * _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
   */
  async update(
    tenantId: string,
    userId: string,
    cbtRole: CbtRole,
    id: string,
    dto: UpdateBankSoalDto,
  ): Promise<typeof cbtBankSoal.$inferSelect> {
    // 1. Get the bank soal first
    const [existing] = await this.db
      .select()
      .from(cbtBankSoal)
      .where(and(eq(cbtBankSoal.id, id), eq(cbtBankSoal.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Bank soal tidak ditemukan");
    }

    // 2. Validate access (admin has full access, guru needs scope check)
    if (!this.isAdmin(cbtRole)) {
      const scope = await this.getGuruScope(userId, tenantId);
      const hasMapelAccess = scope.mataPelajaranIds.includes(
        existing.mataPelajaranId,
      );
      const isCreator = existing.createdBy === userId;

      if (!hasMapelAccess && !isCreator) {
        throw new ForbiddenException(
          "Anda tidak memiliki akses ke bank soal ini",
        );
      }

      // Validate guru scope for new targetKelasIds (if changed)
      if (dto.targetKelasIds && dto.targetKelasIds.length > 0) {
        await this.validateGuruScope(
          userId,
          tenantId,
          existing.mataPelajaranId,
          dto.targetKelasIds,
        );
      }
    }

    // 3. Check if bank soal is locked - BEFORE field validation per requirements
    const isLocked = await this.checkBankSoalLocked(id);
    if (isLocked) {
      throw new ConflictException(
        "Bank soal tidak dapat diubah karena sudah digunakan dalam sesi ujian yang terkunci",
      );
    }

    // 4. Handle tingkat vs targetKelasIds precedence
    let tingkatValue = existing.tingkat;
    if (dto.targetKelasIds !== undefined) {
      // If targetKelasIds explicitly provided (even empty), use it
      tingkatValue =
        dto.targetKelasIds.length > 0
          ? null
          : (dto.tingkat ?? existing.tingkat);
    } else if (dto.tingkat !== undefined) {
      tingkatValue = dto.tingkat;
    }

    // 5. Build update values (only include fields that are provided)
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (dto.nama !== undefined) updateValues.nama = dto.nama;
    if (tingkatValue !== existing.tingkat) updateValues.tingkat = tingkatValue;
    if (dto.durasiMenit !== undefined)
      updateValues.durasiMenit = dto.durasiMenit;
    if (dto.kkm !== undefined) updateValues.kkm = dto.kkm;
    if (dto.shuffleQuestions !== undefined)
      updateValues.shuffleQuestions = dto.shuffleQuestions;
    if (dto.shuffleOptions !== undefined)
      updateValues.shuffleOptions = dto.shuffleOptions;

    // 6. Update with transaction (for atomicity with junction table)
    const [updated] = await this.db.transaction(async (tx) => {
      // Update cbt_bank_soal
      const [result] = await tx
        .update(cbtBankSoal)
        .set(updateValues)
        .where(eq(cbtBankSoal.id, id))
        .returning();

      // Update cbt_bank_soal_kelas if targetKelasIds changed
      if (dto.targetKelasIds !== undefined) {
        // Delete old entries
        await tx
          .delete(cbtBankSoalKelas)
          .where(eq(cbtBankSoalKelas.bankSoalId, id));

        // Insert new entries
        if (dto.targetKelasIds.length > 0) {
          await tx.insert(cbtBankSoalKelas).values(
            dto.targetKelasIds.map((kelasId) => ({
              bankSoalId: id,
              kelasId,
            })),
          );
        }
      }

      return [result];
    });

    return updated;
  }

  /**
   * Delete Bank Soal (with cascade delete of soal)
   *
   * @param tenantId - The tenant ID
   * @param userId - The user's ID
   * @param cbtRole - The user's CBT role
   * @param id - The bank soal ID to delete
   * @throws NotFoundException if bank soal not found
   * @throws ForbiddenException if guru doesn't have access
   * @throws ConflictException if bank soal is used in any exam session
   *
   * _Requirements: 6.1, 6.2, 6.3, 6.4_
   */
  async remove(
    tenantId: string,
    userId: string,
    cbtRole: CbtRole,
    id: string,
  ): Promise<void> {
    // 1. Get the bank soal first
    const [existing] = await this.db
      .select()
      .from(cbtBankSoal)
      .where(and(eq(cbtBankSoal.id, id), eq(cbtBankSoal.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Bank soal tidak ditemukan");
    }

    // 2. Validate access (admin has full access, guru needs scope check)
    if (!this.isAdmin(cbtRole)) {
      const scope = await this.getGuruScope(userId, tenantId);
      const hasMapelAccess = scope.mataPelajaranIds.includes(
        existing.mataPelajaranId,
      );
      const isCreator = existing.createdBy === userId;

      if (!hasMapelAccess && !isCreator) {
        throw new ForbiddenException(
          "Anda tidak memiliki akses ke bank soal ini",
        );
      }
    }

    // 3. Check if bank soal is used in ANY exam session (any status including draft)
    // This is stricter than the lock check - cannot delete if used anywhere
    const isUsed = await this.checkBankSoalUsedInAnySession(id);
    if (isUsed) {
      throw new ConflictException(
        "Bank soal tidak dapat dihapus karena sudah pernah digunakan dalam sesi ujian",
      );
    }

    // 4. Get soal count before deletion (for audit log)
    const [soalCountResult] = await this.db
      .select({ count: count() })
      .from(cbtQuestion)
      .where(eq(cbtQuestion.bankSoalId, id));

    const soalCount = soalCountResult?.count ?? 0;

    // 5. Delete bank soal (cascade deletes soal and bank_soal_kelas via FK)
    await this.db.transaction(async (tx) => {
      // Delete the bank soal - soal and bank_soal_kelas are cascade deleted by FK
      await tx.delete(cbtBankSoal).where(eq(cbtBankSoal.id, id));

      // 6. Create audit log
      await tx.insert(cbtAuditLog).values({
        tenantId,
        actorId: userId,
        actorType: "staff",
        actorRole: this.isAdmin(cbtRole) ? "admin" : "guru",
        action: "delete",
        resourceType: "bank_soal",
        resourceId: id,
        beforeValue: {
          id: existing.id,
          nama: existing.nama,
          mataPelajaranId: existing.mataPelajaranId,
          tingkat: existing.tingkat,
          durasiMenit: existing.durasiMenit,
          kkm: existing.kkm,
          status: existing.status,
        },
        metadata: {
          soalCount,
        },
      });
    });
  }

  // ==================== Advanced Operations ====================

  /**
   * Duplicate Bank Soal with all soal
   *
   * @param tenantId - The tenant ID
   * @param userId - The user's ID
   * @param cbtRole - The user's CBT role
   * @param id - The bank soal ID to duplicate
   * @returns The newly created duplicated Bank Soal
   * @throws NotFoundException if bank soal not found
   * @throws ForbiddenException if guru doesn't have access
   *
   * _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
   */
  async duplicate(
    tenantId: string,
    userId: string,
    cbtRole: CbtRole,
    id: string,
  ): Promise<typeof cbtBankSoal.$inferSelect> {
    // 1. Get the source bank soal
    const [source] = await this.db
      .select()
      .from(cbtBankSoal)
      .where(and(eq(cbtBankSoal.id, id), eq(cbtBankSoal.tenantId, tenantId)))
      .limit(1);

    if (!source) {
      throw new NotFoundException("Bank soal tidak ditemukan");
    }

    // 2. Validate access (admin has full access, guru needs scope check)
    if (!this.isAdmin(cbtRole)) {
      const scope = await this.getGuruScope(userId, tenantId);
      const hasMapelAccess = scope.mataPelajaranIds.includes(
        source.mataPelajaranId,
      );
      const isCreator = source.createdBy === userId;

      if (!hasMapelAccess && !isCreator) {
        throw new ForbiddenException(
          "Anda tidak memiliki akses ke bank soal ini",
        );
      }
    }

    // 3. Get all soal from source bank soal
    const sourceSoal = await this.db
      .select()
      .from(cbtQuestion)
      .where(eq(cbtQuestion.bankSoalId, id))
      .orderBy(asc(cbtQuestion.nomorUrut));

    // 4. Get all target kelas from source bank soal
    const sourceKelas = await this.db
      .select()
      .from(cbtBankSoalKelas)
      .where(eq(cbtBankSoalKelas.bankSoalId, id));

    // 5. Duplicate within transaction
    const [duplicated] = await this.db.transaction(async (tx) => {
      // Create new bank soal with "{original} (Copy)" name and status='draft'
      const [newBankSoal] = await tx
        .insert(cbtBankSoal)
        .values({
          tenantId,
          pelaksanaanUjianId: source.pelaksanaanUjianId,
          mataPelajaranId: source.mataPelajaranId,
          createdBy: userId,
          nama: `${source.nama} (Copy)`,
          tingkat: source.tingkat,
          durasiMenit: source.durasiMenit,
          kkm: source.kkm,
          shuffleQuestions: source.shuffleQuestions,
          shuffleOptions: source.shuffleOptions,
          status: "draft",
        })
        .returning();

      // Copy target kelas entries
      if (sourceKelas.length > 0) {
        await tx.insert(cbtBankSoalKelas).values(
          sourceKelas.map((sk) => ({
            bankSoalId: newBankSoal.id,
            kelasId: sk.kelasId,
          })),
        );
      }

      // Copy all soal with new bank_soal_id
      if (sourceSoal.length > 0) {
        await tx.insert(cbtQuestion).values(
          sourceSoal.map((soal) => ({
            tenantId,
            pelaksanaanUjianId: source.pelaksanaanUjianId,
            bankSoalId: newBankSoal.id,
            createdBy: userId,
            teksSoal: soal.teksSoal,
            gambarSoalUrl: soal.gambarSoalUrl,
            opsiA: soal.opsiA,
            gambarAUrl: soal.gambarAUrl,
            opsiB: soal.opsiB,
            gambarBUrl: soal.gambarBUrl,
            opsiC: soal.opsiC,
            gambarCUrl: soal.gambarCUrl,
            opsiD: soal.opsiD,
            gambarDUrl: soal.gambarDUrl,
            opsiE: soal.opsiE,
            gambarEUrl: soal.gambarEUrl,
            jawabanBenar: soal.jawabanBenar,
            nomorUrut: soal.nomorUrut,
          })),
        );
      }

      return [newBankSoal];
    });

    return duplicated;
  }

  /**
   * Create Exam Session from Bank Soal
   *
   * @param tenantId - The tenant ID
   * @param userId - The guru's user ID
   * @param id - The bank soal ID
   * @param dto - ScheduleExamDto with scheduledAt, kelasId, and optional proctorId
   * @returns The created exam session
   * @throws NotFoundException if bank soal not found
   * @throws ForbiddenException if guru doesn't have access
   * @throws BadRequestException if bank soal has no soal or kelasId is not in target kelas
   *
   * _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
   */
  async scheduleExam(
    tenantId: string,
    userId: string,
    cbtRole: CbtRole,
    id: string,
    dto: ScheduleExamDto,
  ): Promise<typeof cbtExamSession.$inferSelect> {
    // 1. Get the bank soal
    const [bankSoal] = await this.db
      .select()
      .from(cbtBankSoal)
      .where(and(eq(cbtBankSoal.id, id), eq(cbtBankSoal.tenantId, tenantId)))
      .limit(1);

    if (!bankSoal) {
      throw new NotFoundException("Bank soal tidak ditemukan");
    }

    // 2. Validate access (admin has full access, guru needs scope check)
    if (!this.isAdmin(cbtRole)) {
      const scope = await this.getGuruScope(userId, tenantId);
      const hasMapelAccess = scope.mataPelajaranIds.includes(
        bankSoal.mataPelajaranId,
      );
      const isCreator = bankSoal.createdBy === userId;

      if (!hasMapelAccess && !isCreator) {
        throw new ForbiddenException(
          "Anda tidak memiliki akses ke bank soal ini",
        );
      }
    }

    // 3. Check bank soal has at least 1 soal
    const [soalCountResult] = await this.db
      .select({ count: count() })
      .from(cbtQuestion)
      .where(eq(cbtQuestion.bankSoalId, id));

    const soalCount = soalCountResult?.count ?? 0;

    if (soalCount === 0) {
      throw new BadRequestException("Bank soal belum memiliki soal");
    }

    // 4. Validate kelasId is in bank soal's target kelas
    const targetKelas = await this.db
      .select({ kelasId: cbtBankSoalKelas.kelasId })
      .from(cbtBankSoalKelas)
      .where(eq(cbtBankSoalKelas.bankSoalId, id));

    const targetKelasIds = targetKelas.map((tk) => tk.kelasId);

    if (!targetKelasIds.includes(dto.kelasId)) {
      throw new BadRequestException(
        "Kelas yang dipilih bukan target dari bank soal ini",
      );
    }

    // 5. Determine proctor (default to current user if not provided)
    const proctorId = dto.proctorId ?? userId;

    // 6. Get all soal for copying to exam session
    const soalList = await this.db
      .select({
        id: cbtQuestion.id,
        nomorUrut: cbtQuestion.nomorUrut,
      })
      .from(cbtQuestion)
      .where(eq(cbtQuestion.bankSoalId, id))
      .orderBy(asc(cbtQuestion.nomorUrut));

    // 7. Create exam session with bank soal settings in a transaction
    const [examSession] = await this.db.transaction(async (tx) => {
      // Insert cbt_exam_session with settings from bank soal
      const [session] = await tx
        .insert(cbtExamSession)
        .values({
          tenantId,
          pelaksanaanUjianId: bankSoal.pelaksanaanUjianId,
          mataPelajaranId: bankSoal.mataPelajaranId,
          kelasId: dto.kelasId,
          proctorId,
          status: "draft",
          scheduledAt: new Date(dto.scheduledAt),
          durationMinutes: bankSoal.durasiMenit,
          randomizeQuestions: bankSoal.shuffleQuestions,
          randomizeOptions: bankSoal.shuffleOptions,
        })
        .returning();

      // Copy all soal to cbt_exam_session_question with nomorUrut
      if (soalList.length > 0) {
        await tx.insert(cbtExamSessionQuestion).values(
          soalList.map((soal) => ({
            examSessionId: session.id,
            questionId: soal.id,
            nomorUrut: soal.nomorUrut,
          })),
        );
      }

      return [session];
    });

    return examSession;
  }

  // ==================== Soal Management ====================
  // Implemented in Task 5.2

  /**
   * Add soal to Bank Soal
   *
   * @param tenantId - The tenant ID
   * @param userId - The user's ID
   * @param cbtRole - The user's CBT role
   * @param bankSoalId - The bank soal ID to add soal to
   * @param dto - The CreateSoalDto with soal details
   * @returns The created soal record
   * @throws NotFoundException if bank soal not found
   * @throws ForbiddenException if guru doesn't have access
   * @throws ConflictException if bank soal is locked
   *
   * _Requirements: 2.1, 2.6, 2.7, 2.8, 2.9, 2.10_
   */
  async addSoal(
    tenantId: string,
    userId: string,
    cbtRole: CbtRole,
    bankSoalId: string,
    dto: CreateSoalDto,
  ): Promise<typeof cbtQuestion.$inferSelect> {
    // 1. Get the bank soal first
    const [bankSoal] = await this.db
      .select()
      .from(cbtBankSoal)
      .where(
        and(eq(cbtBankSoal.id, bankSoalId), eq(cbtBankSoal.tenantId, tenantId)),
      )
      .limit(1);

    if (!bankSoal) {
      throw new NotFoundException("Bank soal tidak ditemukan");
    }

    // 2. Validate access (admin has full access, guru needs scope check)
    if (!this.isAdmin(cbtRole)) {
      const scope = await this.getGuruScope(userId, tenantId);
      const hasMapelAccess = scope.mataPelajaranIds.includes(
        bankSoal.mataPelajaranId,
      );
      const isCreator = bankSoal.createdBy === userId;

      if (!hasMapelAccess && !isCreator) {
        throw new ForbiddenException(
          "Anda tidak memiliki akses ke bank soal ini",
        );
      }
    }

    // 3. Check if bank soal is locked
    const isLocked = await this.checkBankSoalLocked(bankSoalId);
    if (isLocked) {
      throw new ConflictException(
        "Soal tidak dapat ditambahkan karena bank soal sudah digunakan dalam sesi ujian yang terkunci",
      );
    }

    // 4. Get max nomorUrut for auto-increment
    const [maxNomorResult] = await this.db
      .select({
        maxNomor: sql<number>`COALESCE(MAX(${cbtQuestion.nomorUrut}), 0)`,
      })
      .from(cbtQuestion)
      .where(eq(cbtQuestion.bankSoalId, bankSoalId));

    const nextNomorUrut = dto.nomorUrut ?? (maxNomorResult?.maxNomor ?? 0) + 1;

    // 5. Insert soal
    const [soal] = await this.db
      .insert(cbtQuestion)
      .values({
        tenantId,
        pelaksanaanUjianId: bankSoal.pelaksanaanUjianId,
        bankSoalId,
        createdBy: userId,
        teksSoal: dto.teksSoal,
        gambarSoalUrl: dto.gambarSoalUrl,
        opsiA: dto.opsiA,
        gambarAUrl: dto.gambarAUrl,
        opsiB: dto.opsiB,
        gambarBUrl: dto.gambarBUrl,
        opsiC: dto.opsiC,
        gambarCUrl: dto.gambarCUrl,
        opsiD: dto.opsiD,
        gambarDUrl: dto.gambarDUrl,
        opsiE: dto.opsiE,
        gambarEUrl: dto.gambarEUrl,
        jawabanBenar: dto.jawabanBenar,
        nomorUrut: nextNomorUrut,
      })
      .returning();

    return soal;
  }

  /**
   * Update soal in Bank Soal
   *
   * @param tenantId - The tenant ID
   * @param userId - The user's ID
   * @param cbtRole - The user's CBT role
   * @param bankSoalId - The bank soal ID
   * @param soalId - The soal ID to update
   * @param dto - The UpdateSoalDto with fields to update
   * @returns The updated soal record
   * @throws NotFoundException if bank soal or soal not found
   * @throws ForbiddenException if guru doesn't have access
   * @throws ConflictException if bank soal is locked (checked BEFORE field validation)
   *
   * _Requirements: 2.1, 2.6, 2.7, 2.8, 2.9, 2.10_
   */
  async updateSoal(
    tenantId: string,
    userId: string,
    cbtRole: CbtRole,
    bankSoalId: string,
    soalId: string,
    dto: UpdateSoalDto,
  ): Promise<typeof cbtQuestion.$inferSelect> {
    // 1. Get the bank soal first
    const [bankSoal] = await this.db
      .select()
      .from(cbtBankSoal)
      .where(
        and(eq(cbtBankSoal.id, bankSoalId), eq(cbtBankSoal.tenantId, tenantId)),
      )
      .limit(1);

    if (!bankSoal) {
      throw new NotFoundException("Bank soal tidak ditemukan");
    }

    // 2. Validate access (admin has full access, guru needs scope check)
    if (!this.isAdmin(cbtRole)) {
      const scope = await this.getGuruScope(userId, tenantId);
      const hasMapelAccess = scope.mataPelajaranIds.includes(
        bankSoal.mataPelajaranId,
      );
      const isCreator = bankSoal.createdBy === userId;

      if (!hasMapelAccess && !isCreator) {
        throw new ForbiddenException(
          "Anda tidak memiliki akses ke bank soal ini",
        );
      }
    }

    // 3. Check if bank soal is locked - BEFORE field validation per requirements
    const isLocked = await this.checkBankSoalLocked(bankSoalId);
    if (isLocked) {
      throw new ConflictException(
        "Soal tidak dapat diubah karena bank soal sudah digunakan dalam sesi ujian yang terkunci",
      );
    }

    // 4. Get the soal and verify it belongs to this bank soal
    const [existingSoal] = await this.db
      .select()
      .from(cbtQuestion)
      .where(
        and(eq(cbtQuestion.id, soalId), eq(cbtQuestion.bankSoalId, bankSoalId)),
      )
      .limit(1);

    if (!existingSoal) {
      throw new NotFoundException("Soal tidak ditemukan");
    }

    // 5. Build update values (only include fields that are provided)
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (dto.teksSoal !== undefined) updateValues.teksSoal = dto.teksSoal;
    if (dto.gambarSoalUrl !== undefined)
      updateValues.gambarSoalUrl = dto.gambarSoalUrl;
    if (dto.opsiA !== undefined) updateValues.opsiA = dto.opsiA;
    if (dto.gambarAUrl !== undefined) updateValues.gambarAUrl = dto.gambarAUrl;
    if (dto.opsiB !== undefined) updateValues.opsiB = dto.opsiB;
    if (dto.gambarBUrl !== undefined) updateValues.gambarBUrl = dto.gambarBUrl;
    if (dto.opsiC !== undefined) updateValues.opsiC = dto.opsiC;
    if (dto.gambarCUrl !== undefined) updateValues.gambarCUrl = dto.gambarCUrl;
    if (dto.opsiD !== undefined) updateValues.opsiD = dto.opsiD;
    if (dto.gambarDUrl !== undefined) updateValues.gambarDUrl = dto.gambarDUrl;
    if (dto.opsiE !== undefined) updateValues.opsiE = dto.opsiE;
    if (dto.gambarEUrl !== undefined) updateValues.gambarEUrl = dto.gambarEUrl;
    if (dto.jawabanBenar !== undefined)
      updateValues.jawabanBenar = dto.jawabanBenar;
    if (dto.nomorUrut !== undefined) updateValues.nomorUrut = dto.nomorUrut;

    // 6. Update soal - bank_soal_id is preserved (not in updateValues)
    const [updated] = await this.db
      .update(cbtQuestion)
      .set(updateValues)
      .where(eq(cbtQuestion.id, soalId))
      .returning();

    return updated;
  }

  /**
   * Delete soal from Bank Soal
   *
   * @param tenantId - The tenant ID
   * @param userId - The guru's user ID
   * @param bankSoalId - The bank soal ID
   * @param soalId - The soal ID to delete
   * @throws NotFoundException if bank soal or soal not found
   * @throws ForbiddenException if guru doesn't have access
   * @throws ConflictException if bank soal is locked (checked BEFORE any other validation)
   *
   * _Requirements: 2.1, 2.6, 2.7, 2.8, 2.9, 2.10_
   */
  async removeSoal(
    tenantId: string,
    userId: string,
    cbtRole: CbtRole,
    bankSoalId: string,
    soalId: string,
  ): Promise<void> {
    // 1. Get the bank soal first
    const [bankSoal] = await this.db
      .select()
      .from(cbtBankSoal)
      .where(
        and(eq(cbtBankSoal.id, bankSoalId), eq(cbtBankSoal.tenantId, tenantId)),
      )
      .limit(1);

    if (!bankSoal) {
      throw new NotFoundException("Bank soal tidak ditemukan");
    }

    // 2. Validate access (admin has full access, guru needs scope check)
    if (!this.isAdmin(cbtRole)) {
      const scope = await this.getGuruScope(userId, tenantId);
      const hasMapelAccess = scope.mataPelajaranIds.includes(
        bankSoal.mataPelajaranId,
      );
      const isCreator = bankSoal.createdBy === userId;

      if (!hasMapelAccess && !isCreator) {
        throw new ForbiddenException(
          "Anda tidak memiliki akses ke bank soal ini",
        );
      }
    }

    // 3. Check if bank soal is locked - BEFORE any other validation per requirements
    const isLocked = await this.checkBankSoalLocked(bankSoalId);
    if (isLocked) {
      throw new ConflictException(
        "Soal tidak dapat dihapus karena bank soal sudah digunakan dalam sesi ujian yang terkunci",
      );
    }

    // 4. Get the soal and verify it belongs to this bank soal
    const [existingSoal] = await this.db
      .select()
      .from(cbtQuestion)
      .where(
        and(eq(cbtQuestion.id, soalId), eq(cbtQuestion.bankSoalId, bankSoalId)),
      )
      .limit(1);

    if (!existingSoal) {
      throw new NotFoundException("Soal tidak ditemukan");
    }

    // 5. Delete soal
    await this.db.delete(cbtQuestion).where(eq(cbtQuestion.id, soalId));
  }

  // ==================== Bulk Import ====================

  /**
   * Import soal from Excel file
   *
   * @param tenantId - The tenant ID
   * @param userId - The user's ID
   * @param cbtRole - The user's CBT role
   * @param bankSoalId - The bank soal ID to import into
   * @param file - Excel file buffer
   * @returns Import result with count and any errors
   * @throws NotFoundException if bank soal not found
   * @throws ForbiddenException if guru doesn't have access
   * @throws ConflictException if bank soal is locked
   * @throws BadRequestException if all rows are invalid
   *
   * _Requirements: 3.4_
   */
  async importSoal(
    tenantId: string,
    userId: string,
    cbtRole: CbtRole,
    bankSoalId: string,
    file: Buffer,
  ): Promise<ImportResult> {
    // 1. Get the bank soal first
    const [bankSoal] = await this.db
      .select()
      .from(cbtBankSoal)
      .where(
        and(eq(cbtBankSoal.id, bankSoalId), eq(cbtBankSoal.tenantId, tenantId)),
      )
      .limit(1);

    if (!bankSoal) {
      throw new NotFoundException("Bank soal tidak ditemukan");
    }

    // 2. Validate access (admin has full access, guru needs scope check)
    if (!this.isAdmin(cbtRole)) {
      const scope = await this.getGuruScope(userId, tenantId);
      const hasMapelAccess = scope.mataPelajaranIds.includes(
        bankSoal.mataPelajaranId,
      );
      const isCreator = bankSoal.createdBy === userId;

      if (!hasMapelAccess && !isCreator) {
        throw new ForbiddenException(
          "Anda tidak memiliki akses ke bank soal ini",
        );
      }
    }

    // 3. Check if bank soal is locked
    const isLocked = await this.checkBankSoalLocked(bankSoalId);
    if (isLocked) {
      throw new ConflictException(
        "Soal tidak dapat diimpor karena bank soal sudah digunakan dalam sesi ujian yang terkunci",
      );
    }

    // 4. Parse and validate Excel
    const parseResult = await this.parseExcel(file);

    // 5. If all rows invalid, return BadRequestException with errors
    if (parseResult.validRows.length === 0) {
      if (parseResult.errors.length > 0) {
        throw new BadRequestException({
          message: "Semua baris tidak valid",
          errors: parseResult.errors,
        });
      } else {
        throw new BadRequestException("File Excel tidak memiliki data soal");
      }
    }

    // 6. Get max nomorUrut for auto-increment
    const [maxNomorResult] = await this.db
      .select({
        maxNomor: sql<number>`COALESCE(MAX(${cbtQuestion.nomorUrut}), 0)`,
      })
      .from(cbtQuestion)
      .where(eq(cbtQuestion.bankSoalId, bankSoalId));

    let nextNomorUrut = (maxNomorResult?.maxNomor ?? 0) + 1;

    // 7. Insert all valid soal in single transaction (all or nothing)
    await this.db.transaction(async (tx) => {
      for (const row of parseResult.validRows) {
        await tx.insert(cbtQuestion).values({
          tenantId,
          pelaksanaanUjianId: bankSoal.pelaksanaanUjianId,
          bankSoalId,
          createdBy: userId,
          teksSoal: row.teksSoal,
          opsiA: row.opsiA,
          opsiB: row.opsiB,
          opsiC: row.opsiC,
          opsiD: row.opsiD,
          opsiE: row.opsiE,
          jawabanBenar: row.jawabanBenar,
          nomorUrut: nextNomorUrut++,
        });
      }
    });

    return {
      importedCount: parseResult.validRows.length,
      errors: parseResult.errors,
      totalRows: parseResult.totalRows,
    };
  }

  /**
   * Parse Excel file for soal import
   *
   * @param file - Excel file buffer
   * @returns Parse result with valid rows and errors
   * @throws BadRequestException if file has no worksheet or required columns are missing
   *
   * _Requirements: 3.1, 3.2, 3.3_
   */
  async parseExcel(file: Buffer | ArrayBuffer): Promise<ImportParseResult> {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.default.Workbook();
    await workbook.xlsx.load(file as ArrayBuffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException("File Excel tidak memiliki worksheet");
    }

    // 1. Validate required columns exist
    const headerRow = sheet.getRow(1);
    const headers: Record<string, number> = {};

    headerRow.eachCell((cell, colNumber) => {
      const value = cell.value?.toString().toLowerCase().trim();
      if (value) {
        headers[value] = colNumber;
      }
    });

    const requiredColumns = [
      "nomor_soal",
      "teks_soal",
      "jawaban_benar",
      "opsi_a",
      "opsi_b",
      "opsi_c",
      "opsi_d",
    ];

    const missingColumns = requiredColumns.filter((col) => !headers[col]);
    if (missingColumns.length > 0) {
      throw new BadRequestException(
        `Kolom yang diperlukan tidak ditemukan: ${missingColumns.join(", ")}`,
      );
    }

    // 2. Parse and validate each row
    const validRows: ParsedSoalRow[] = [];
    const errors: ImportRowError[] = [];
    let totalRows = 0;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      // Check if row has any data (not empty)
      const hasData =
        row.values &&
        Array.isArray(row.values) &&
        row.values.some((v) => v !== null && v !== undefined && v !== "");

      if (!hasData) return;

      totalRows++;
      const rowErrors: string[] = [];

      // Extract cell values
      const getCellValue = (colName: string): string => {
        const colNum = headers[colName];
        if (!colNum) return "";
        const cell = row.getCell(colNum);
        return cell.value?.toString().trim() ?? "";
      };

      const nomorSoal =
        parseInt(getCellValue("nomor_soal"), 10) || rowNumber - 1;
      const teksSoal = getCellValue("teks_soal");
      const jawabanBenar = getCellValue("jawaban_benar").toUpperCase();
      const opsiA = getCellValue("opsi_a");
      const opsiB = getCellValue("opsi_b");
      const opsiC = getCellValue("opsi_c");
      const opsiD = getCellValue("opsi_d");
      const opsiE = getCellValue("opsi_e") || null;

      // 3. Validate row
      if (!teksSoal) {
        rowErrors.push("Teks soal tidak boleh kosong");
      } else if (teksSoal.length > 2000) {
        rowErrors.push("Teks soal maksimal 2000 karakter");
      }

      if (!["A", "B", "C", "D", "E"].includes(jawabanBenar)) {
        rowErrors.push("Jawaban benar harus A, B, C, D, atau E");
      }

      if (!opsiA) {
        rowErrors.push("Opsi A tidak boleh kosong");
      } else if (opsiA.length > 500) {
        rowErrors.push("Opsi A maksimal 500 karakter");
      }

      if (!opsiB) {
        rowErrors.push("Opsi B tidak boleh kosong");
      } else if (opsiB.length > 500) {
        rowErrors.push("Opsi B maksimal 500 karakter");
      }

      if (!opsiC) {
        rowErrors.push("Opsi C tidak boleh kosong");
      } else if (opsiC.length > 500) {
        rowErrors.push("Opsi C maksimal 500 karakter");
      }

      if (!opsiD) {
        rowErrors.push("Opsi D tidak boleh kosong");
      } else if (opsiD.length > 500) {
        rowErrors.push("Opsi D maksimal 500 karakter");
      }

      // opsiE required if jawabanBenar is E
      if (jawabanBenar === "E" && !opsiE) {
        rowErrors.push("Opsi E wajib diisi jika jawaban benar adalah E");
      }

      if (opsiE && opsiE.length > 500) {
        rowErrors.push("Opsi E maksimal 500 karakter");
      }

      if (rowErrors.length > 0) {
        errors.push({ row: rowNumber, errors: rowErrors });
      } else {
        validRows.push({
          nomorSoal,
          teksSoal,
          jawabanBenar,
          opsiA,
          opsiB,
          opsiC,
          opsiD,
          opsiE,
        });
      }
    });

    return { validRows, errors, totalRows };
  }

  /**
   * Generate Excel template for bulk import
   *
   * Creates an Excel workbook with:
   * - Header row with column names
   * - Example rows with valid data
   * - Data validation for jawaban_benar column (A-E)
   *
   * @returns Buffer containing the Excel file
   *
   * _Requirements: 3.5_
   */
  async generateTemplate(): Promise<Buffer> {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.default.Workbook();
    const sheet = workbook.addWorksheet("Template Soal");

    // Define columns
    sheet.columns = [
      { header: "nomor_soal", key: "nomor_soal", width: 12 },
      { header: "teks_soal", key: "teks_soal", width: 50 },
      { header: "jawaban_benar", key: "jawaban_benar", width: 15 },
      { header: "opsi_a", key: "opsi_a", width: 30 },
      { header: "opsi_b", key: "opsi_b", width: 30 },
      { header: "opsi_c", key: "opsi_c", width: 30 },
      { header: "opsi_d", key: "opsi_d", width: 30 },
      { header: "opsi_e", key: "opsi_e", width: 30 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Add example rows with valid data
    sheet.addRow({
      nomor_soal: 1,
      teks_soal: "Berapakah hasil dari 5 + 3?",
      jawaban_benar: "C",
      opsi_a: "6",
      opsi_b: "7",
      opsi_c: "8",
      opsi_d: "9",
      opsi_e: "",
    });

    sheet.addRow({
      nomor_soal: 2,
      teks_soal: "Siapakah proklamator Indonesia?",
      jawaban_benar: "A",
      opsi_a: "Soekarno dan Hatta",
      opsi_b: "Soeharto",
      opsi_c: "Sukarno",
      opsi_d: "Hatta",
      opsi_e: "Ki Hajar Dewantara",
    });

    sheet.addRow({
      nomor_soal: 3,
      teks_soal: "Planet terbesar di tata surya adalah...",
      jawaban_benar: "B",
      opsi_a: "Saturnus",
      opsi_b: "Jupiter",
      opsi_c: "Mars",
      opsi_d: "Bumi",
      opsi_e: "",
    });

    // Add data validation for jawaban_benar column (A-E)
    // Apply to rows 2 onwards (skip header)
    for (let rowNum = 2; rowNum <= 100; rowNum++) {
      const cell = sheet.getCell(`C${rowNum}`);
      cell.dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: ['"A,B,C,D,E"'],
        showErrorMessage: true,
        errorTitle: "Jawaban Tidak Valid",
        error: "Pilih jawaban A, B, C, D, atau E",
      };
    }

    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
