import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";

import { SiswaAuthGuard } from "../../common/guards";
import { CurrentUser } from "../../common/decorators";
import { ExamTakingService } from "./exam-taking.service";
import { SaveAnswerDto, SubmitExamDto } from "./dto";

@Controller("siswa/exam-sessions")
@UseGuards(SiswaAuthGuard)
export class ExamTakingController {
  constructor(private readonly examTakingService: ExamTakingService) {}

  /**
   * GET /api/siswa/exam-sessions
   * List all assigned exam sessions for the authenticated siswa.
   */
  @Get()
  async listSessions(@CurrentUser("siswaAccountId") siswaAccountId: string) {
    return this.examTakingService.listSessions(siswaAccountId);
  }

  /**
   * GET /api/siswa/exam-sessions/:id/start
   * Start an exam — returns randomized questions.
   * If already in_progress, resumes (returns current state).
   */
  @Get(":id/start")
  async startExam(
    @CurrentUser("siswaAccountId") siswaAccountId: string,
    @Param("id", ParseUUIDPipe) sessionId: string,
  ) {
    return this.examTakingService.startExam(siswaAccountId, sessionId);
  }

  /**
   * POST /api/siswa/exam-sessions/:id/answer
   * Save a single answer for a question.
   */
  @Post(":id/answer")
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async saveAnswer(
    @CurrentUser("siswaAccountId") siswaAccountId: string,
    @Param("id", ParseUUIDPipe) sessionId: string,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.examTakingService.saveAnswer(
      siswaAccountId,
      sessionId,
      dto.questionId,
      dto.option,
    );
  }

  /**
   * POST /api/siswa/exam-sessions/:id/submit
   * Final submission of the exam.
   */
  @Post(":id/submit")
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async submitExam(
    @CurrentUser("siswaAccountId") siswaAccountId: string,
    @Param("id", ParseUUIDPipe) sessionId: string,
    @Body() _dto: SubmitExamDto,
  ) {
    return this.examTakingService.submitExam(siswaAccountId, sessionId);
  }

  /**
   * GET /api/siswa/exam-sessions/:id/result
   * View exam results (if released).
   */
  @Get(":id/result")
  async getResult(
    @CurrentUser("siswaAccountId") siswaAccountId: string,
    @Param("id", ParseUUIDPipe) sessionId: string,
  ) {
    return this.examTakingService.getResult(siswaAccountId, sessionId);
  }
}
