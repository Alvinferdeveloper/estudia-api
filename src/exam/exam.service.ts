import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Exam, QuestionType } from '../typeorm/entities/Exam.entity';
import { ExamQuestion } from '../typeorm/entities/ExamQuestion.entity';
import {
  ExamAttempt,
  ExamAttemptMode,
  ExamAttemptStatus,
} from '../typeorm/entities/ExamAttempt.entity';
import { ExamAnswer } from '../typeorm/entities/ExamAnswer.entity';
import { Document } from '../typeorm/entities/Document.entity';
import { ErrorCode } from '../common/errors/error-codes';
import { AIService } from '../ai/ai.service';
import { aiCallContext } from '../ai/metering/ai-call-context';
import { AIProviderException } from '../ai/providers/ai-provider.exception';
import type { AnswerQuestionDto, GenerateExamDto } from './dto/exam.dto';
import {
  DEADLINE_GRACE_MS,
  attemptDeadline,
  simulationTimeLimit,
} from './exam-timing';
import {
  type AnswerView,
  type AttemptSummary,
  type AttemptView,
  type ExamView,
  revealsGrades,
  toAnswerView,
  toAttemptSummary,
  toExamView,
  toQuestionView,
} from './exam-views';

// Open answers are graded by the model; generation pays for this many AI gradings per question.
const MAX_AI_EVALUATIONS_PER_QUESTION = 5;
// A 0-10 grade from here up counts as a correct answer.
const PASSING_SCORE = 5;

interface GeneratedQuestion {
  text: string;
  type: QuestionType;
  options?: string[];
  idealAnswer: string;
}

interface Grade {
  score: number;
  feedback: string | null;
}

export interface ExamWithAttempts extends ExamView {
  attempts: AttemptSummary[];
}

// Practice grades what was answered, so leaving early doesn't count skipped questions as wrong;
// a simulation is graded over every question.
const scoreAttempt = (
  attempt: ExamAttempt,
  answers: ExamAnswer[],
): number => {
  const graded =
    attempt.mode === ExamAttemptMode.PRACTICE
      ? answers.length
      : attempt.totalQuestions;
  if (graded === 0) return 0;
  const total = answers.reduce((sum, answer) => sum + (answer.score ?? 0), 0);
  return Math.round((total / graded) * 10);
};

@Injectable()
export class ExamService {
  private readonly logger = new Logger(ExamService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly aiService: AIService,
    @InjectRepository(Exam)
    private readonly examRepository: Repository<Exam>,
    @InjectRepository(ExamQuestion)
    private readonly questionRepository: Repository<ExamQuestion>,
    @InjectRepository(ExamAttempt)
    private readonly attemptRepository: Repository<ExamAttempt>,
    @InjectRepository(ExamAnswer)
    private readonly answerRepository: Repository<ExamAnswer>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  // Generates the questions and stores the exam with them and its first attempt in one step,
  // so only server-made questions are ever graded.
  async generate(
    userId: string,
    dto: GenerateExamDto,
  ): Promise<{ examId: string; attemptId: string }> {
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
          difficulty: dto.difficulty,
          title: dto.title || 'Exam',
          questionType: dto.questionType,
          totalQuestions: generated.length,
        }),
      );
      await manager.save(
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
      const attempt = await this.createAttempt(
        manager,
        exam,
        userId,
        dto.mode,
        generated,
      );
      return { examId: exam.id, attemptId: attempt.id };
    });
  }

  async startAttempt(
    userId: string,
    examId: string,
    mode: ExamAttemptMode,
  ): Promise<{ attemptId: string }> {
    const exam = await this.getOwnedExam(userId, examId);
    const questions = await this.questionRepository.find({
      where: { examId },
      select: { type: true },
    });
    const attempt = await this.createAttempt(
      this.dataSource.manager,
      exam,
      userId,
      mode,
      questions,
    );
    return { attemptId: attempt.id };
  }

  async getAttempt(
    userId: string,
    examId: string,
    attemptId: string,
  ): Promise<AttemptView> {
    const attempt = await this.getOwnedAttempt(userId, examId, attemptId);
    const [exam, questions, answers] = await Promise.all([
      this.examRepository.findOneByOrFail({ id: examId }),
      this.questionRepository.find({ where: { examId }, order: { order: 'ASC' } }),
      this.answerRepository.find({ where: { attemptId } }),
    ]);
    const questionsById = new Map(questions.map((q) => [q.id, q]));
    const reveal = revealsGrades(attempt);

    return {
      attempt: toAttemptSummary(attempt),
      exam: toExamView(exam),
      questions: questions.map(toQuestionView),
      answers: answers.map((answer) =>
        toAnswerView(answer, questionsById.get(answer.questionId)!, reveal),
      ),
      serverNow: new Date(),
    };
  }

  // Practice grades each answer as it is given; resending one returns the saved grade, so a retry
  // never spends a second AI grading. A simulation only stores the answer (changeable until the
  // end) and grades everything on finish.
  async answer(
    userId: string,
    examId: string,
    attemptId: string,
    dto: AnswerQuestionDto,
  ): Promise<AnswerView> {
    const attempt = await this.getOwnedAttempt(userId, examId, attemptId);
    this.assertAnswerable(attempt);

    const question = await this.questionRepository.findOne({
      where: { id: dto.questionId, examId },
    });
    if (!question) {
      throw new NotFoundException({ code: ErrorCode.EXAM_NOT_FOUND });
    }

    const existing = await this.answerRepository.findOne({
      where: { attemptId, questionId: question.id },
    });

    if (attempt.mode === ExamAttemptMode.SIMULATION) {
      const saved = await this.answerRepository.save(
        existing
          ? Object.assign(existing, { userAnswer: dto.userAnswer })
          : this.answerRepository.create({
              attemptId,
              questionId: question.id,
              userAnswer: dto.userAnswer,
              score: null,
            }),
      );
      return toAnswerView(saved, question, false);
    }

    if (existing) return toAnswerView(existing, question, true);

    const grade = await this.grade(
      userId,
      question,
      dto.userAnswer,
      dto.responseLanguage,
    );
    const saved = await this.answerRepository.save(
      this.answerRepository.create({
        attemptId,
        questionId: question.id,
        userAnswer: dto.userAnswer,
        ...grade,
      }),
    );
    return toAnswerView(saved, question, true);
  }

  // Grades what is still ungraded (a simulation's answers) and closes the attempt. If a grading
  // fails the attempt stays open with every answer kept, and finishing again grades only the rest.
  // Idempotent: finishing a finished attempt returns it unchanged.
  async finish(
    userId: string,
    examId: string,
    attemptId: string,
  ): Promise<AttemptView> {
    const attempt = await this.getOwnedAttempt(userId, examId, attemptId);

    if (attempt.status === ExamAttemptStatus.IN_PROGRESS) {
      const answers = await this.gradePending(userId, attempt);
      await this.attemptRepository.update(attempt.id, {
        status: ExamAttemptStatus.COMPLETED,
        finishedAt: new Date(),
        score: scoreAttempt(attempt, answers),
        correctAnswers: answers.filter(
          (a) => a.score !== null && a.score >= PASSING_SCORE,
        ).length,
      });
    }

    return this.getAttempt(userId, examId, attemptId);
  }

  // The user's exams, newest first, each with its attempts (in-progress ones can be resumed).
  async getUserExams(
    userId: string,
    documentId?: string,
  ): Promise<ExamWithAttempts[]> {
    const exams = await this.examRepository.find({
      where: documentId ? { userId, documentId } : { userId },
      order: { createdAt: 'DESC' },
    });
    if (exams.length === 0) return [];

    const attempts = await this.attemptRepository.find({
      where: { examId: In(exams.map((exam) => exam.id)) },
      order: { startedAt: 'DESC' },
    });

    return exams.map((exam) => ({
      ...toExamView(exam),
      attempts: attempts
        .filter((attempt) => attempt.examId === exam.id)
        .map(toAttemptSummary),
    }));
  }

  async rename(
    userId: string,
    examId: string,
    title: string,
  ): Promise<ExamView> {
    const exam = await this.getOwnedExam(userId, examId);
    exam.title = title;
    return toExamView(await this.examRepository.save(exam));
  }

  async getOwnedExam(userId: string, examId: string): Promise<Exam> {
    const exam = await this.examRepository.findOne({
      where: { id: examId, userId },
    });
    if (!exam) {
      throw new NotFoundException({ code: ErrorCode.EXAM_NOT_FOUND });
    }
    return exam;
  }

  private createAttempt(
    manager: EntityManager,
    exam: Exam,
    userId: string,
    mode: ExamAttemptMode,
    questions: { type: QuestionType | null }[],
  ): Promise<ExamAttempt> {
    return manager.save(
      manager.create(ExamAttempt, {
        examId: exam.id,
        userId,
        mode,
        totalQuestions: exam.totalQuestions,
        timeLimitSeconds:
          mode === ExamAttemptMode.SIMULATION
            ? simulationTimeLimit(questions)
            : null,
      }),
    );
  }

  private async getOwnedAttempt(
    userId: string,
    examId: string,
    attemptId: string,
  ): Promise<ExamAttempt> {
    const attempt = await this.attemptRepository.findOne({
      where: { id: attemptId, examId, userId },
    });
    if (!attempt) {
      throw new NotFoundException({ code: ErrorCode.EXAM_NOT_FOUND });
    }
    return attempt;
  }

  private assertAnswerable(attempt: ExamAttempt): void {
    if (attempt.status !== ExamAttemptStatus.IN_PROGRESS) {
      throw new ConflictException({ code: ErrorCode.EXAM_ATTEMPT_FINISHED });
    }
    const deadline = attemptDeadline(attempt);
    if (deadline && Date.now() > deadline.getTime() + DEADLINE_GRACE_MS) {
      throw new ConflictException({ code: ErrorCode.EXAM_TIME_UP });
    }
  }

  // Grades the attempt's ungraded answers in parallel, saving each one that succeeds.
  private async gradePending(
    userId: string,
    attempt: ExamAttempt,
  ): Promise<ExamAnswer[]> {
    const answers = await this.answerRepository.find({
      where: { attemptId: attempt.id },
      relations: { question: true },
    });
    const pending = answers.filter((answer) => answer.score === null);

    const results = await Promise.allSettled(
      pending.map(async (answer) => {
        Object.assign(
          answer,
          await this.grade(userId, answer.question, answer.userAnswer),
        );
        await this.answerRepository.save(answer);
      }),
    );

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      this.logger.error(
        `Could not grade ${failures.length} answers of attempt ${attempt.id}`,
      );
      // A spent evaluation limit is the error worth showing; otherwise the model failed.
      const reason = (failures[0] as PromiseRejectedResult).reason;
      throw reason instanceof ForbiddenException
        ? reason
        : new AIProviderException('Exam grading failed', reason);
    }
    return answers;
  }

  // Closed questions are graded without the model, so only open ones spend gradings.
  private async grade(
    userId: string,
    question: ExamQuestion,
    userAnswer: string,
    responseLanguage?: string,
  ): Promise<Grade> {
    // A cleared simulation answer stays on record as blank; it's wrong without asking the model.
    if (!userAnswer.trim()) return { score: 0, feedback: null };
    if (question.type === QuestionType.OPEN) {
      await this.spendEvaluation(question.id);
    }
    const evaluation = await aiCallContext.run({ userId }, () =>
      this.aiService.evaluateAnswer({
        question: question.text,
        idealAnswer: question.idealAnswer ?? '',
        questionType: question.type ?? QuestionType.OPEN,
        userAnswer,
        responseLanguage,
      }),
    );
    return { score: evaluation.score, feedback: evaluation.feedback || null };
  }

  // Conditional increment, so parallel requests can't exceed the paid gradings.
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
