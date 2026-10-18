import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUserId } from '../../common/decorators/user.decorator';
import {
  ReviewFlashcardDto,
  ReviewScopeDto,
} from '../dto/flashcard-review.dto';
import { FlashcardReviewService } from './flashcard-review.service';

// Spaced repetition. Reviewing is free: no AI is involved.
@Controller('flashcards')
@UseGuards(AuthGuard)
export class FlashcardReviewController {
  constructor(private readonly reviewService: FlashcardReviewService) {}

  @Get('due')
  async findDue(
    @CurrentUserId() userId: string,
    @Query() scope: ReviewScopeDto,
  ) {
    return this.reviewService.findDue(userId, scope.documentId);
  }

  @Get('summary')
  async summary(
    @CurrentUserId() userId: string,
    @Query() scope: ReviewScopeDto,
  ) {
    return this.reviewService.summary(userId, scope.documentId);
  }

  @Post(':id/review')
  async review(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewFlashcardDto,
  ) {
    return this.reviewService.review(userId, id, dto.rating);
  }
}
