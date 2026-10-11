import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { QuestionType } from '../../typeorm/entities/Exam.entity';
import { ExamAttemptMode } from '../../typeorm/entities/ExamAttempt.entity';
import { IsResponseLanguage } from '../../ai/language';

// Bounds the input tokens of one generation (roughly 20 dense pages).
const MAX_CONTENT_CHARS = 100_000;

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

// Mirrored in estudia-front `exam/hooks/useExam.ts` (EXAM_TITLE_MAX_LENGTH) for the inputs.
export const MAX_TITLE_LENGTH = 120;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class GenerateExamDto {
  @IsUUID()
  documentId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  pages: number[];

  // Text of the selected pages, extracted by the client's PDF viewer.
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CONTENT_CHARS)
  content: string;

  // The first attempt starts right away in this mode.
  @IsOptional()
  @IsEnum(ExamAttemptMode)
  mode: ExamAttemptMode = ExamAttemptMode.PRACTICE;

  @IsIn(DIFFICULTIES)
  difficulty: (typeof DIFFICULTIES)[number];

  @IsEnum(QuestionType)
  questionType: QuestionType;

  // The plan's examQuestions cap is the real upper bound.
  @IsOptional()
  @IsInt()
  @Min(1)
  questionCount: number = 5;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_TITLE_LENGTH)
  title?: string;

  @IsResponseLanguage()
  responseLanguage?: string;
}

export class RenameExamDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TITLE_LENGTH)
  title: string;
}

// The mode an attempt is taken in.
export class StartAttemptDto {
  @IsEnum(ExamAttemptMode)
  mode: ExamAttemptMode;
}

export class AnswerQuestionDto {
  @IsUUID()
  questionId: string;

  @IsString()
  @MaxLength(4000)
  userAnswer: string;

  @IsResponseLanguage()
  responseLanguage?: string;
}
