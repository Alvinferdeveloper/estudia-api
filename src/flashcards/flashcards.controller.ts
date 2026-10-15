import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FlashcardsService } from './flashcards.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';
import { CreditsService } from '../entitlements/credits/credits.service';
import {
  AddVocabularyDto,
  CreateFlashcardDto,
  GenerateNoteFlashcardsDto,
  SaveNoteFlashcardsDto,
  UpdateFlashcardDto,
} from './dto/flashcard.dto';

@Controller()
@UseGuards(AuthGuard)
export class FlashcardsController {
  constructor(
    private readonly flashcardsService: FlashcardsService,
    private readonly creditsService: CreditsService,
  ) {}

  @Get('documents/:documentId/flashcards')
  async findByDocument(
    @CurrentUserId() userId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.flashcardsService.findByDocument(userId, documentId);
  }

  @Post('documents/:documentId/flashcards')
  async create(
    @CurrentUserId() userId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: CreateFlashcardDto,
  ) {
    return this.flashcardsService.create(userId, documentId, dto);
  }

  @Post('documents/:documentId/flashcards/from-vocabulary')
  async addVocabulary(
    @CurrentUserId() userId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: AddVocabularyDto,
  ) {
    return this.flashcardsService.addVocabulary(
      userId,
      documentId,
      dto.vocabularyEntryIds,
    );
  }

  @Post('annotations/:id/flashcards/proposals')
  async proposeFromNote(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) annotationId: string,
    @Body() dto: GenerateNoteFlashcardsDto,
  ) {
    return this.creditsService.charge(
      userId,
      { action: 'flashcard.generate' },
      () =>
        this.flashcardsService.proposeFromNote(
          userId,
          annotationId,
          dto.responseLanguage,
        ),
    );
  }

  @Post('annotations/:id/flashcards')
  async saveFromNote(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) annotationId: string,
    @Body() dto: SaveNoteFlashcardsDto,
  ) {
    return this.flashcardsService.saveFromNote(userId, annotationId, dto.cards);
  }

  @Patch('flashcards/:id')
  async update(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFlashcardDto,
  ) {
    return this.flashcardsService.update(userId, id, dto);
  }

  @Delete('flashcards/:id')
  async delete(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.flashcardsService.delete(userId, id);
    return { success: true };
  }
}
