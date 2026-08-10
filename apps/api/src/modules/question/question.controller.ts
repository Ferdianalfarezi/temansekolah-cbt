import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CbtRole } from "@/common/enums";

import { JwtAuthGuard, TenantGuard, RolesGuard } from "../../common/guards";
import { CurrentUser, Roles } from "../../common/decorators";
import { QuestionService } from "./question.service";
import {
  CreateQuestionDto,
  UpdateQuestionDto,
  ListQuestionsQueryDto,
  ConfirmImportDto,
} from "./dto";

@Controller("questions")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(CbtRole.ADMIN_SEKOLAH, CbtRole.GURU)
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  /**
   * GET /api/questions
   * List questions scoped to guru's assignments.
   */
  @Get()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async list(
    @CurrentUser("userId") userId: string,
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("role") role: string,
    @Query() query: ListQuestionsQueryDto,
  ) {
    return this.questionService.listQuestions(tenantId, userId, role, query);
  }

  /**
   * POST /api/questions
   * Create a single question.
   */
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(
    @CurrentUser("userId") userId: string,
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("role") role: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.questionService.createQuestion(tenantId, userId, role, dto);
  }

  /**
   * PUT /api/questions/:id
   * Edit a question (only if not in locked session).
   */
  @Put(":id")
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async update(
    @CurrentUser("userId") userId: string,
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("role") role: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionService.updateQuestion(tenantId, userId, role, id, dto);
  }

  /**
   * DELETE /api/questions/:id
   * Delete a question with lock validation.
   */
  @Delete(":id")
  async delete(
    @CurrentUser("userId") userId: string,
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("role") role: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.questionService.deleteQuestion(tenantId, userId, role, id);
  }

  /**
   * POST /api/questions/import
   * Upload Excel file, parse, and return preview JSON.
   */
  @Post("import")
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
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("File tidak ditemukan");
    }
    const preview = this.questionService.parseExcel(file.buffer);
    return { preview, count: preview.length };
  }

  /**
   * POST /api/questions/import/confirm
   * Save previewed questions to DB.
   */
  @Post("import/confirm")
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async confirmImport(
    @CurrentUser("userId") userId: string,
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("role") role: string,
    @Body() dto: ConfirmImportDto,
  ) {
    return this.questionService.confirmImport(tenantId, userId, role, dto);
  }

  /**
   * GET /api/questions/template
   * Download Excel template.
   */
  @Get("template")
  async downloadTemplate(@Res() res: any) {
    const buffer = this.questionService.generateTemplate();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="template-soal.xlsx"',
    );
    res.send(buffer);
  }

  /**
   * POST /api/questions/:id/image
   * Upload image for a question field to S3.
   * Query param `field` specifies which image field (gambar_soal, gambar_a, etc.)
   */
  @Post(":id/image")
  @UseInterceptors(
    FileInterceptor("image", {
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
      fileFilter: (_req, file, cb) => {
        const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new Error("Hanya file gambar (JPEG, PNG, WebP) yang diperbolehkan"),
            false,
          );
        }
      },
    }),
  )
  async uploadImage(
    @CurrentUser("userId") userId: string,
    @CurrentUser("tenantId") tenantId: string,
    @CurrentUser("role") role: string,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Query("field") field: string,
  ) {
    if (!file) {
      throw new BadRequestException("File gambar tidak ditemukan");
    }
    if (!field) {
      throw new BadRequestException("Query param 'field' wajib diisi");
    }
    return this.questionService.uploadImage(
      tenantId,
      userId,
      role,
      id,
      file,
      field,
    );
  }
}
