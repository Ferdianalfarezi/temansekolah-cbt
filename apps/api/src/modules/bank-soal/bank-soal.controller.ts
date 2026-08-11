import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { CbtRole } from "@/common/enums";

import { JwtAuthGuard, TenantGuard, RolesGuard } from "../../common/guards";
import { CurrentUser, Roles } from "../../common/decorators";
import { BankSoalService } from "./bank-soal.service";
import {
  CreateBankSoalDto,
  UpdateBankSoalDto,
  ListBankSoalQueryDto,
  CreateSoalDto,
  UpdateSoalDto,
  ScheduleExamDto,
} from "./dto";

/**
 * BankSoalController - REST API endpoints for Bank Soal management
 *
 * All endpoints are guarded by:
 * - JwtAuthGuard: Requires valid JWT token
 * - TenantGuard: Extracts tenant context
 * - RolesGuard: Restricts to Guru role
 *
 * Implementation will be filled in Task 8.1
 */
@Controller("bank-soal")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(CbtRole.GURU)
export class BankSoalController {
  constructor(private readonly bankSoalService: BankSoalService) {}

  // ==================== Bank Soal CRUD ====================

  /**
   * POST /api/bank-soal
   * Create a new Bank Soal
   */
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateBankSoalDto,
  ) {
    return this.bankSoalService.create(tenantId, userId, dto);
  }

  /**
   * GET /api/bank-soal
   * List Bank Soal with filters and pagination
   */
  @Get()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async findAll(
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("userId") userId: string,
    @Query() query: ListBankSoalQueryDto,
  ) {
    return this.bankSoalService.findAll(tenantId, userId, query);
  }

  /**
   * GET /api/bank-soal/template
   * Download Excel template for bulk import
   *
   * _Requirements: 3.5_
   */
  @Get("template")
  async getTemplate(@Res() res: Response) {
    const buffer = await this.bankSoalService.generateTemplate();

    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template_soal.xlsx"',
      "Content-Length": buffer.length,
    });

    res.end(buffer);
  }

  /**
   * GET /api/bank-soal/:id
   * Get Bank Soal detail with all soal
   */
  @Get(":id")
  async findOne(
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("userId") userId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.bankSoalService.findOne(tenantId, userId, id);
  }

  /**
   * PATCH /api/bank-soal/:id
   * Update Bank Soal settings
   */
  @Patch(":id")
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async update(
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("userId") userId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateBankSoalDto,
  ) {
    return this.bankSoalService.update(tenantId, userId, id, dto);
  }

  /**
   * DELETE /api/bank-soal/:id
   * Delete Bank Soal (cascade deletes soal)
   */
  @Delete(":id")
  async remove(
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("userId") userId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.bankSoalService.remove(tenantId, userId, id);
  }

  // ==================== Advanced Operations ====================

  /**
   * POST /api/bank-soal/:id/duplicate
   * Duplicate Bank Soal with all soal
   */
  @Post(":id/duplicate")
  async duplicate(
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("userId") userId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.bankSoalService.duplicate(tenantId, userId, id);
  }

  /**
   * POST /api/bank-soal/:id/schedule
   * Create Exam Session from Bank Soal
   *
   * _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
   */
  @Post(":id/schedule")
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async scheduleExam(
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("userId") userId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ScheduleExamDto,
  ) {
    return this.bankSoalService.scheduleExam(tenantId, userId, id, dto);
  }

  // ==================== Soal Management ====================

  /**
   * POST /api/bank-soal/:id/soal
   * Add soal to Bank Soal
   */
  @Post(":id/soal")
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async addSoal(
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("userId") userId: string,
    @Param("id", ParseUUIDPipe) bankSoalId: string,
    @Body() dto: CreateSoalDto,
  ) {
    return this.bankSoalService.addSoal(tenantId, userId, bankSoalId, dto);
  }

  /**
   * PATCH /api/bank-soal/:id/soal/:soalId
   * Update soal in Bank Soal
   */
  @Patch(":id/soal/:soalId")
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateSoal(
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("userId") userId: string,
    @Param("id", ParseUUIDPipe) bankSoalId: string,
    @Param("soalId", ParseUUIDPipe) soalId: string,
    @Body() dto: UpdateSoalDto,
  ) {
    return this.bankSoalService.updateSoal(
      tenantId,
      userId,
      bankSoalId,
      soalId,
      dto,
    );
  }

  /**
   * DELETE /api/bank-soal/:id/soal/:soalId
   * Delete soal from Bank Soal
   */
  @Delete(":id/soal/:soalId")
  async removeSoal(
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("userId") userId: string,
    @Param("id", ParseUUIDPipe) bankSoalId: string,
    @Param("soalId", ParseUUIDPipe) soalId: string,
  ) {
    return this.bankSoalService.removeSoal(
      tenantId,
      userId,
      bankSoalId,
      soalId,
    );
  }

  /**
   * POST /api/bank-soal/:id/soal/import
   * Bulk import soal from Excel
   *
   * _Requirements: 3.1, 3.2, 3.3, 3.4_
   */
  @Post(":id/soal/import")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
      fileFilter: (_req, file, cb) => {
        const allowedMimes = [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new Error("Hanya file Excel (.xlsx, .xls) yang diperbolehkan"),
            false,
          );
        }
      },
    }),
  )
  async importSoal(
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("userId") userId: string,
    @Param("id", ParseUUIDPipe) bankSoalId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("File tidak ditemukan");
    }
    return this.bankSoalService.importSoal(
      tenantId,
      userId,
      bankSoalId,
      file.buffer,
    );
  }
}
