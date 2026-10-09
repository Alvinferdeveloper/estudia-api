import { QuestionType } from '../typeorm/entities/Exam.entity';

// Time a simulation gives per question; written answers need longer than picking one.
// Mirrored in estudia-front `exam/lib/exam-timing.ts` to preview the limit before generating.
export const SECONDS_PER_QUESTION: Record<
  Exclude<QuestionType, QuestionType.MIXED>,
  number
> = {
  [QuestionType.OPEN]: 180,
  [QuestionType.FILL_BLANK]: 90,
  [QuestionType.MULTIPLE_CHOICE]: 60,
  [QuestionType.TRUE_FALSE]: 45,
};

// Absorbs the latency of an answer sent in the last seconds.
export const DEADLINE_GRACE_MS = 15_000;

export const simulationTimeLimit = (
  questions: { type: QuestionType | null }[],
): number =>
  questions.reduce(
    (total, { type }) =>
      total +
      SECONDS_PER_QUESTION[
        type && type !== QuestionType.MIXED ? type : QuestionType.OPEN
      ],
    0,
  );

export const attemptDeadline = (attempt: {
  startedAt: Date;
  timeLimitSeconds: number | null;
}): Date | null =>
  attempt.timeLimitSeconds === null
    ? null
    : new Date(attempt.startedAt.getTime() + attempt.timeLimitSeconds * 1000);
