import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
  AnswerQuestionDto,
  GenerateExamDto,
  RenameExamDto,
  StartAttemptDto,
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

  // The price scales with the exam size; grading its answers is included.
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

  @Patch(':id')
  async rename(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) examId: string,
    @Body() dto: RenameExamDto,
  ) {
    return this.examService.rename(userId, examId, dto.title);
  }

  @Post(':id/attempts')
  async startAttempt(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) examId: string,
    @Body() dto: StartAttemptDto,
  ) {
    return this.examService.startAttempt(userId, examId, dto.mode);
  }

  @Get(':id/attempts/:attemptId')
  async getAttempt(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) examId: string,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.examService.getAttempt(userId, examId, attemptId);
  }

  @Post(':id/attempts/:attemptId/answers')
  async answer(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) examId: string,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: AnswerQuestionDto,
  ) {
    return this.examService.answer(userId, examId, attemptId, dto);
  }

  @Post(':id/attempts/:attemptId/finish')
  async finish(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) examId: string,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.examService.finish(userId, examId, attemptId);
  }
}
