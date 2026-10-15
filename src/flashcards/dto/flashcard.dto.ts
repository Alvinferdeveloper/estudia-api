import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Mirrored in estudia-front `flashcards/lib/flashcard-limits.ts` for the inputs.
export const MAX_FRONT_LENGTH = 500;
export const MAX_BACK_LENGTH = 4000;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateFlashcardDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_FRONT_LENGTH)
  front: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_BACK_LENGTH)
  back: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  pageNumber?: number;
}

export class UpdateFlashcardDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_FRONT_LENGTH)
  front?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_BACK_LENGTH)
  back?: string;
}
