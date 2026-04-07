import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ExamService } from './exam.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';
import { ExamMode, QuestionType } from '../typeorm/entities/Exam.entity';

interface CreateExamDto {
  documentId: string;
  pages: number[];
  mode: ExamMode;
  difficulty?: string;
  title?: string;
  questionType?: QuestionType;
  totalQuestions?: number;
}

interface SaveResultDto {
  examId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
}

interface SaveQuestionsDto {
  examId: string;
  questions: { text: string; type: string; options?: string; idealAnswer: string; order: number }[];
}

@Controller('exam')
@UseGuards(AuthGuard)
export class ExamController {
  constructor(private readonly examService: ExamService) { }

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
    @Param('id') examId: string,
  ) {
    return this.examService.getExamById(examId);
  }

  @Get(':id/questions')
  async getExamQuestions(
    @CurrentUserId() userId: string,
    @Param('id') examId: string,
  ) {
    return this.examService.getExamQuestionsByExamId(examId);
  }

  @Get(':id/results')
  async getExamResults(
    @CurrentUserId() userId: string,
    @Param('id') examId: string,
  ) {
    return this.examService.getExamResults(examId);
  }

  @Post()
  async createExam(
    @CurrentUserId() userId: string,
    @Body() createExamDto: CreateExamDto,
  ) {
    return this.examService.createExam(userId, createExamDto);
  }

  @Post('questions')
  async saveQuestions(
    @CurrentUserId() userId: string,
    @Body() questionsDto: SaveQuestionsDto,
  ) {
    await this.examService.addQuestions(questionsDto.examId, questionsDto.questions);
    return { success: true };
  }

  @Post('result')
  async saveResult(
    @CurrentUserId() userId: string,
    @Body() resultDto: SaveResultDto,
  ) {
    return this.examService.saveExamResult(resultDto);
  }
}
