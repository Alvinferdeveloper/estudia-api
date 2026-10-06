import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ExamService } from './exam.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { CreditsService } from '../entitlements/credits/credits.service';
import {
  EvaluateAnswerDto,
  GenerateExamDto,
  SaveExamResultDto,
} from './dto/exam.dto';

@Controller('exam')
@UseGuards(AuthGuard)
export class ExamController {
  constructor(
    private readonly examService: ExamService,
    private readonly entitlementsService: EntitlementsService,
    private readonly creditsService: CreditsService,
  ) {}

  @Get()
  async getExams(
    @CurrentUserId() userId: string,
    @Query('documentId') documentId?: string,
  ) {
    return this.examService.getUserExams(userId, documentId);
  }

  @Get(':id')
  async getExam(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) examId: string,
  ) {
    return this.examService.getOwnedExam(userId, examId);
  }

  @Get(':id/questions')
  async getExamQuestions(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) examId: string,
  ) {
    return this.examService.getQuestions(userId, examId);
  }

  @Get(':id/results')
  async getExamResults(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) examId: string,
  ) {
    return this.examService.getResults(userId, examId);
  }

  // The price scales with the exam size; evaluating its answers is included.
  @Post('generate')
  async generate(
    @CurrentUserId() userId: string,
    @Body() dto: GenerateExamDto,
  ) {
    await this.entitlementsService.assertCap(
      userId,
      'examQuestions',
      dto.questionCount,
    );
    return this.creditsService.charge(
      userId,
      { action: 'exam.generate', params: { questions: dto.questionCount } },
      () => this.examService.generate(userId, dto),
    );
  }

  @Post(':id/questions/:questionId/evaluate')
  async evaluateAnswer(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) examId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: EvaluateAnswerDto,
  ) {
    return this.examService.evaluateAnswer(userId, examId, questionId, dto);
  }

  @Post('result')
  async saveResult(
    @CurrentUserId() userId: string,
    @Body() dto: SaveExamResultDto,
  ) {
    return this.examService.saveResult(userId, dto);
  }
}
