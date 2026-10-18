import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flashcard } from '../typeorm/entities/Flashcard.entity';
import { FlashcardReview } from '../typeorm/entities/FlashcardReview.entity';
import { FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { FlashcardReviewController } from './review/flashcard-review.controller';
import { FlashcardReviewService } from './review/flashcard-review.service';
import { AIModule } from '../ai/ai.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Flashcard, FlashcardReview]),
    AIModule,
    EntitlementsModule,
  ],
  controllers: [FlashcardsController, FlashcardReviewController],
  providers: [FlashcardsService, FlashcardReviewService],
})
export class FlashcardsModule {}
