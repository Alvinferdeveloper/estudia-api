import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IsResponseLanguage } from '../../ai/language';
import { MAX_CARDS_PER_NOTE } from '../../ai/prompts/flashcard.prompts';

// Mirrored in estudia-front `flashcards/lib/flashcard-limits.ts` for the inputs.
export const MAX_FRONT_LENGTH = 500;
export const MAX_BACK_LENGTH = 4000;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class FlashcardContentDto {
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
}

export class CreateFlashcardDto extends FlashcardContentDto {
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

export class AddVocabularyDto {
  // Omitted: every saved word of the document that has no card yet.
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  vocabularyEntryIds?: string[];
}

export class GenerateNoteFlashcardsDto {
  @IsResponseLanguage()
  responseLanguage?: string;
}

// The proposals the user accepted, possibly edited.
export class SaveNoteFlashcardsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_CARDS_PER_NOTE)
  @ValidateNested({ each: true })
  @Type(() => FlashcardContentDto)
  cards: FlashcardContentDto[];
}
