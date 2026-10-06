import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Exam, QuestionType } from '../typeorm/entities/Exam.entity';
import { ExamQuestion } from '../typeorm/entities/ExamQuestion.entity';
import { ExamResult } from '../typeorm/entities/ExamResult.entity';
import { Document } from '../typeorm/entities/Document.entity';
import { ErrorCode } from '../common/errors/error-codes';
import { AIService } from '../ai/ai.service';
import { aiCallContext } from '../ai/metering/ai-call-context';
import type {
  EvaluateAnswerDto,
  GenerateExamDto,
  SaveExamResultDto,
} from './dto/exam.dto';

// Open answers are graded by the model; generation pays for this many attempts per question.
const MAX_AI_EVALUATIONS_PER_QUESTION = 5;

interface GeneratedQuestion {
  text: string;
  type: QuestionType;
  options?: string[];
  idealAnswer: string;
}

@Injectable()
export class ExamService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly aiService: AIService,
    @InjectRepository(Exam)
    private readonly examRepository: Repository<Exam>,
    @InjectRepository(ExamQuestion)
    private readonly questionRepository: Repository<ExamQuestion>,
    @InjectRepository(ExamResult)
    private readonly resultRepository: Repository<ExamResult>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  // Generates the questions and stores the exam with them in one step, so only server-made
  // questions can later be evaluated.
  async generate(
    userId: string,
    dto: GenerateExamDto,
  ): Promise<{ exam: Exam; questions: ExamQuestion[] }> {
    await this.verifyDocumentAccess(dto.documentId, userId);

    const generated: GeneratedQuestion[] =
      await this.aiService.generateQuestions({
        content: dto.content,
        pages: dto.pages,
        difficulty: dto.difficulty,
        questionType: dto.questionType,
        numQuestions: dto.questionCount,
        responseLanguage: dto.responseLanguage,
      });

    return this.dataSource.transaction(async (manager) => {
      const exam = await manager.save(
        manager.create(Exam, {
          userId,
          documentId: dto.documentId,
          pages: dto.pages,
          mode: dto.mode,
          difficulty: dto.difficulty,
          title: dto.title || 'Exam',
          questionType: dto.questionType,
          totalQuestions: generated.length,
        }),
      );
      const questions = await manager.save(
        generated.map((question, index) =>
          manager.create(ExamQuestion, {
            examId: exam.id,
            order: index + 1,
            text: question.text,
            type: question.type,
            options: question.options ? JSON.stringify(question.options) : null,
            idealAnswer: question.idealAnswer,
          }),
        ),
      );
      return { exam, questions };
    });
  }

  async evaluateAnswer(
    userId: string,
    examId: string,
    questionId: string,
    dto: EvaluateAnswerDto,
  ): Promise<{ score: number; feedback: string }> {
    await this.getOwnedExam(userId, examId);
    const question = await this.questionRepository.findOne({
      where: { id: questionId, examId },
    });
    if (!question) {
      throw new NotFoundException({ code: ErrorCode.EXAM_NOT_FOUND });
    }

    // Closed questions are graded without the model, so only open ones spend attempts.
    if (question.type === QuestionType.OPEN) {
      await this.spendEvaluation(question.id);
    }

    return aiCallContext.run({ userId }, () =>
      this.aiService.evaluateAnswer({
        question: question.text,
        idealAnswer: question.idealAnswer ?? '',
        questionType: question.type ?? QuestionType.OPEN,
        userAnswer: dto.userAnswer,
        responseLanguage: dto.responseLanguage,
      }),
    );
  }

  async saveResult(
    userId: string,
    dto: SaveExamResultDto,
  ): Promise<ExamResult> {
    await this.getOwnedExam(userId, dto.examId);
    return this.resultRepository.save(this.resultRepository.create(dto));
  }

  async getUserExams(userId: string, documentId?: string): Promise<Exam[]> {
    return this.examRepository.find({
      where: documentId ? { userId, documentId } : { userId },
      relations: ['document'],
      order: { createdAt: 'DESC' },
    });
  }

  async getOwnedExam(userId: string, examId: string): Promise<Exam> {
    const exam = await this.examRepository.findOne({
      where: { id: examId, userId },
      relations: ['document'],
    });
    if (!exam) {
      throw new NotFoundException({ code: ErrorCode.EXAM_NOT_FOUND });
    }
    return exam;
  }

  async getQuestions(userId: string, examId: string): Promise<ExamQuestion[]> {
    await this.getOwnedExam(userId, examId);
    return this.questionRepository.find({
      where: { examId },
      order: { order: 'ASC' },
    });
  }

  async getResults(userId: string, examId: string): Promise<ExamResult[]> {
    await this.getOwnedExam(userId, examId);
    return this.resultRepository.find({
      where: { examId },
      order: { createdAt: 'DESC' },
    });
  }

  // Conditional increment, so parallel requests can't exceed the paid attempts.
  private async spendEvaluation(questionId: string): Promise<void> {
    const result = await this.questionRepository
      .createQueryBuilder()
      .update(ExamQuestion)
      .set({ evaluationCount: () => 'evaluationCount + 1' })
      .where('id = :questionId AND evaluationCount < :max', {
        questionId,
        max: MAX_AI_EVALUATIONS_PER_QUESTION,
      })
      .execute();

    if (!result.affected) {
      throw new ForbiddenException({
        code: ErrorCode.EVALUATION_LIMIT_REACHED,
      });
    }
  }

  private async verifyDocumentAccess(
    documentId: string,
    userId: string,
  ): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, userId },
    });
    if (!document) {
      throw new ForbiddenException({
        code: ErrorCode.DOCUMENT_ACCESS_DENIED,
      });
    }
  }
}
