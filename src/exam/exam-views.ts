import type { Exam } from '../typeorm/entities/Exam.entity';
import type { ExamQuestion } from '../typeorm/entities/ExamQuestion.entity';
import {
  type ExamAttempt,
  ExamAttemptMode,
  ExamAttemptStatus,
} from '../typeorm/entities/ExamAttempt.entity';
import type { ExamAnswer } from '../typeorm/entities/ExamAnswer.entity';
import { attemptDeadline } from './exam-timing';

// What the client sees. Questions never carry their ideal answer: it is only revealed
// alongside the grade of an answered question, and a simulation reveals grades only once finished.

export type ExamView = Pick<
  Exam,
  | 'id'
  | 'documentId'
  | 'title'
  | 'difficulty'
  | 'questionType'
  | 'pages'
  | 'totalQuestions'
  | 'createdAt'
>;

export type AttemptSummary = Pick<
  ExamAttempt,
  | 'id'
  | 'mode'
  | 'status'
  | 'startedAt'
  | 'finishedAt'
  | 'score'
  | 'correctAnswers'
  | 'totalQuestions'
  | 'timeLimitSeconds'
> & { deadline: Date | null };

export interface QuestionView {
  id: string;
  order: number;
  text: string;
  type: ExamQuestion['type'];
  options: string[] | null;
}

export interface AnswerView {
  questionId: string;
  userAnswer: string;
  score: number | null;
  feedback: string | null;
  idealAnswer: string | null;
}

export interface AttemptView {
  attempt: AttemptSummary;
  exam: ExamView;
  questions: QuestionView[];
  answers: AnswerView[];
  // Lets the client run the countdown on the server's clock.
  serverNow: Date;
}

export const toExamView = (exam: Exam): ExamView => ({
  id: exam.id,
  documentId: exam.documentId,
  title: exam.title,
  difficulty: exam.difficulty,
  questionType: exam.questionType,
  pages: exam.pages,
  totalQuestions: exam.totalQuestions,
  createdAt: exam.createdAt,
});

export const toAttemptSummary = (attempt: ExamAttempt): AttemptSummary => ({
  id: attempt.id,
  mode: attempt.mode,
  status: attempt.status,
  startedAt: attempt.startedAt,
  finishedAt: attempt.finishedAt,
  score: attempt.score,
  correctAnswers: attempt.correctAnswers,
  totalQuestions: attempt.totalQuestions,
  timeLimitSeconds: attempt.timeLimitSeconds,
  deadline: attemptDeadline(attempt),
});

export const revealsGrades = (attempt: ExamAttempt): boolean =>
  attempt.mode === ExamAttemptMode.PRACTICE ||
  attempt.status === ExamAttemptStatus.COMPLETED;

export const toQuestionView = (question: ExamQuestion): QuestionView => ({
  id: question.id,
  order: question.order,
  text: question.text,
  type: question.type,
  options: question.options ? (JSON.parse(question.options) as string[]) : null,
});

export const toAnswerView = (
  answer: ExamAnswer,
  question: ExamQuestion,
  reveal: boolean,
): AnswerView => ({
  questionId: answer.questionId,
  userAnswer: answer.userAnswer,
  score: reveal ? answer.score : null,
  feedback: reveal ? answer.feedback : null,
  idealAnswer: reveal ? question.idealAnswer : null,
});
