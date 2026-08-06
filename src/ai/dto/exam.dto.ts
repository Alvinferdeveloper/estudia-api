import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class GenerateQuestionsDto {
  @IsString()
  content: string;

  @IsArray()
  pages: number[];

  @IsString()
  difficulty: string;

  @IsOptional()
  @IsString()
  questionType?: string;

  @IsOptional()
  @IsNumber()
  numQuestions?: number;
}

export class EvaluateAnswerDto {
  @IsString()
  userAnswer: string;

  @IsString()
  idealAnswer: string;

  @IsString()
  question: string;

  @IsOptional()
  @IsString()
  questionType?: string;
}
