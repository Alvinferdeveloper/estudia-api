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
import { CreateFlashcardDto, UpdateFlashcardDto } from './dto/flashcard.dto';

@Controller()
@UseGuards(AuthGuard)
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

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
