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
import { QuestionType } from '../../typeorm/entities/Exam.entity';
import { ExamAttemptMode } from '../../typeorm/entities/ExamAttempt.entity';
import { IsResponseLanguage } from '../../ai/language';

// Bounds the input tokens of one generation (roughly 20 dense pages).
const MAX_CONTENT_CHARS = 100_000;

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

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
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsResponseLanguage()
  responseLanguage?: string;
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
