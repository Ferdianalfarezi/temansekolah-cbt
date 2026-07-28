import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
@UseGuards(JwtAuthGuard, TenantGuard)
export class PelaksanaanUjianController {
  constructor(private readonly puService: PelaksanaanUjianService) {}

  /**
   * POST /api/pelaksanaan-ujian
   * Create a new Pelaksanaan Ujian. Admin only.
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(CbtRole.ADMIN_SEKOLAH)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(
    @CurrentUser("tenantId") tenantId: string,
    @Body() dto: CreatePelaksanaanUjianDto,
  ) {
    return this.puService.create(tenantId, dto);
  }

  /**
   * PATCH /api/pelaksanaan-ujian/:id/deactivate
   * Deactivate a Pelaksanaan Ujian. Admin only.
   */
  @Patch(":id/deactivate")
  @UseGuards(RolesGuard)
  @Roles(CbtRole.ADMIN_SEKOLAH)
  async deactivate(
    @CurrentUser("tenantId") tenantId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.puService.deactivate(tenantId, id);
  }

  /**
   * GET /api/pelaksanaan-ujian
   * List all Pelaksanaan Ujian (active + historical). Admin only.
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(CbtRole.ADMIN_SEKOLAH)
  async list(@CurrentUser("tenantId") tenantId: string) {
    return this.puService.list(tenantId);
  }

  /**
   * GET /api/pelaksanaan-ujian/active
   * Get the current active Pelaksanaan Ujian. Admin + Guru.
   */
  @Get("active")
  @UseGuards(RolesGuard)
  @Roles(CbtRole.ADMIN_SEKOLAH, CbtRole.GURU)
  async getActive(@CurrentUser("tenantId") tenantId: string) {
    return this.puService.getActive(tenantId);
  }

  /**
   * GET /api/pelaksanaan-ujian/komponen-penilaian
   * Get komponen_penilaian options from LMS for dropdown. Admin only.
   */
  @Get("komponen-penilaian")
  @UseGuards(RolesGuard)
  @Roles(CbtRole.ADMIN_SEKOLAH)
  async getKomponenPenilaian(@CurrentUser("tenantId") tenantId: string) {
    return this.puService.getKomponenPenilaian(tenantId);
  }
}
