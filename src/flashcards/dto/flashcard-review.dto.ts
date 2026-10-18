import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { FlashcardRating } from '../../typeorm/entities/FlashcardReview.entity';

// Without a document, the review covers every document of the user.
export class ReviewScopeDto {
  @IsOptional()
  @IsUUID()
  documentId?: string;
}

export class ReviewFlashcardDto {
  @IsEnum(FlashcardRating)
  rating: FlashcardRating;
}
