import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exam, ExamMode, QuestionType } from '../typeorm/entities/Exam.entity';
import { ExamQuestion } from '../typeorm/entities/ExamQuestion.entity';
import { ExamResult } from '../typeorm/entities/ExamResult.entity';
import { Document } from '../typeorm/entities/Document.entity';

interface CreateExamDto {
  documentId: string;
  pages: number[];
  mode: ExamMode;
  difficulty?: string;
  title?: string;
  questionType?: QuestionType;
  totalQuestions?: number;
}

interface SaveExamResultDto {
  examId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
}

@Injectable()
export class ExamService {
  constructor(
    @InjectRepository(Exam)
    private examRepository: Repository<Exam>,
    @InjectRepository(ExamQuestion)
    private questionRepository: Repository<ExamQuestion>,
    @InjectRepository(ExamResult)
    private resultRepository: Repository<ExamResult>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
  ) { }

  async createExam(userId: string, dto: CreateExamDto): Promise<Exam> {
    await this.verifyDocumentAccess(dto.documentId, userId);

    const exam = this.examRepository.create({
      userId,
      documentId: dto.documentId,
      pages: dto.pages,
      mode: dto.mode,
      difficulty: dto.difficulty || 'medium',
      title: dto.title || 'Exam',
      questionType: dto.questionType || QuestionType.OPEN,
      totalQuestions: dto.totalQuestions || 5,
    });

    return this.examRepository.save(exam);
  }

  async addQuestions(examId: string, questions: { text: string; type: string; options?: string; idealAnswer: string; order: number }[]): Promise<void> {
    const questionEntities = questions.map(q => this.questionRepository.create({
      examId,
      text: q.text,
      type: q.type as QuestionType,
      options: q.options || null,
      idealAnswer: q.idealAnswer,
      order: q.order,
    }));

    await this.questionRepository.save(questionEntities);
  }

  async saveExamResult(dto: SaveExamResultDto): Promise<ExamResult> {
    const examResult = this.resultRepository.create({
      examId: dto.examId,
      score: dto.score,
      correctAnswers: dto.correctAnswers,
      totalQuestions: dto.totalQuestions,
    });

    return this.resultRepository.save(examResult);
  }

  async getExamResults(examId: string): Promise<ExamResult[]> {
    return this.resultRepository.find({
      where: { examId },
      order: { createdAt: 'DESC' },
    });
  }

  async getUserExams(userId: string, documentId?: string): Promise<Exam[]> {
    const where: any = { userId };
    if (documentId) {
      where.documentId = documentId;
    }

    return this.examRepository.find({
      where,
      relations: ['document'],
      order: { createdAt: 'DESC' },
    });
  }

  async getExamById(examId: string): Promise<Exam | null> {
    return this.examRepository.findOne({
      where: { id: examId },
      relations: ['document'],
    });
  }

  async getExamQuestions(examId: string): Promise<ExamQuestion[]> {
    return this.questionRepository.find({
      where: { examId },
      order: { order: 'ASC' },
    });
  }

  async getExamQuestionsByExamId(examId: string): Promise<ExamQuestion[]> {
    return this.getExamQuestions(examId);
  }

  private async verifyDocumentAccess(documentId: string, userId: string): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, userId },
    });
    if (!document) {
      throw new UnauthorizedException('Access to this document is denied');
    }
  }
}
