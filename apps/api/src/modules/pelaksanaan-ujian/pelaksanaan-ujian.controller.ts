import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { CbtRole } from "@/common/enums";

import { JwtAuthGuard, TenantGuard, RolesGuard } from "../../common/guards";
import { CurrentUser, Roles } from "../../common/decorators";
import { PelaksanaanUjianService } from "./pelaksanaan-ujian.service";
import { CreatePelaksanaanUjianDto } from "./dto/create-pelaksanaan-ujian.dto";

@Controller("pelaksanaan-ujian")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(CbtRole.ADMIN_SEKOLAH, CbtRole.GURU)
export class PelaksanaanUjianController {
  constructor(private readonly puService: PelaksanaanUjianService) {}

  /**
   * POST /api/pelaksanaan-ujian
   * Create a new Pelaksanaan Ujian.
   * Tahun ajaran is automatically set to the active one from LMS.
   */
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(
    @CurrentUser("tenantId") tenantId: string,
    @Body() dto: CreatePelaksanaanUjianDto,
  ) {
    return this.puService.create(tenantId, dto);
  }

  /**
   * PATCH /api/pelaksanaan-ujian/:id/deactivate
   * Deactivate a Pelaksanaan Ujian.
   */
  @Patch(":id/deactivate")
  async deactivate(
    @CurrentUser("tenantId") tenantId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.puService.deactivate(tenantId, id);
  }

  /**
   * GET /api/pelaksanaan-ujian
   * List all Pelaksanaan Ujian with optional filters.
   */
  @Get()
  async list(
    @CurrentUser("tenantId") tenantId: string,
    @Query("periodeRapor") periodeRapor?: string,
    @Query("isActive") isActiveStr?: string,
  ) {
    const filters: { periodeRapor?: string; isActive?: boolean } = {};

    if (periodeRapor) {
      filters.periodeRapor = periodeRapor;
    }

    if (isActiveStr !== undefined && isActiveStr !== "") {
      filters.isActive = isActiveStr === "true";
    }

    return this.puService.list(
      tenantId,
      Object.keys(filters).length > 0 ? filters : undefined,
    );
  }

  /**
   * GET /api/pelaksanaan-ujian/active
   * Get the current active Pelaksanaan Ujian.
   */
  @Get("active")
  async getActive(@CurrentUser("tenantId") tenantId: string) {
    return this.puService.getActive(tenantId);
  }

  /**
   * GET /api/pelaksanaan-ujian/tahun-ajaran-aktif
   * Get the current active tahun ajaran from LMS.
   */
  @Get("tahun-ajaran-aktif")
  async getTahunAjaranAktif(@CurrentUser("tenantId") tenantId: string) {
    return this.puService.getActiveTahunAjaran(tenantId);
  }
}
