import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { VocabularyService } from './vocabulary.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  BoundingRect,
  AnnotationRect,
} from '../typeorm/entities/Annotation.entity';
import { VocabularyExplanation } from '../typeorm/entities/VocabularyEntry.entity';

@Controller()
@UseGuards(AuthGuard)
export class VocabularyController {
  constructor(
    private readonly vocabularyService: VocabularyService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Get('documents/:documentId/vocabulary')
  async findByDocument(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.vocabularyService.findByDocument(documentId, userId);
  }

  @Post('documents/:documentId/vocabulary')
  async create(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUserId() userId: string,
    @Body()
    createVocabularyDto: {
      selectedText: string;
      wordLanguage: string;
      explanationLanguage: string;
      color?: string;
      pageNumber: number;
      boundingRect: BoundingRect;
      rects?: AnnotationRect[];
      explanation?: VocabularyExplanation;
    },
  ) {
    if (createVocabularyDto.explanation) {
      const canUse = await this.subscriptionsService.canUseAiNote(userId);
      if (!canUse) {
        throw new ForbiddenException(
          'You have reached your AI notes limit. Upgrade your plan to continue.',
        );
      }
      await this.subscriptionsService.incrementAiNoteUsage(userId);
    }

    return this.vocabularyService.create({
      ...createVocabularyDto,
      documentId,
      userId,
    });
  }

  @Patch('vocabulary/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string,
    @Body()
    updateVocabularyDto: {
      color?: string;
      explanation?: VocabularyExplanation | null;
      boundingRect?: BoundingRect;
      rects?: AnnotationRect[];
    },
  ) {
    if (updateVocabularyDto.explanation) {
      const canUse = await this.subscriptionsService.canUseAiNote(userId);
      if (!canUse) {
        throw new ForbiddenException(
          'You have reached your AI notes limit. Upgrade your plan to continue.',
        );
      }
      await this.subscriptionsService.incrementAiNoteUsage(userId);
    }

    return this.vocabularyService.update(id, userId, updateVocabularyDto);
  }

  @Delete('vocabulary/:id')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string,
  ) {
    await this.vocabularyService.delete(id, userId);
    return { success: true };
  }
}
