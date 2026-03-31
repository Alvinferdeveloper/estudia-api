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
import { AnnotationsService } from './annotations.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Controller()
@UseGuards(AuthGuard)
export class AnnotationsController {
  constructor(
    private readonly annotationsService: AnnotationsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Get('documents/:documentId/annotations')
  async findByDocument(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.annotationsService.findByDocument(documentId, userId);
  }

  @Get('documents/:documentId/annotations/page/:pageNumber')
  async findByPage(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Param('pageNumber') pageNumber: number,
    @CurrentUserId() userId: string,
  ) {
    return this.annotationsService.findByPage(documentId, pageNumber, userId);
  }

  @Post('documents/:documentId/annotations')
  async create(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUserId() userId: string,
    @Body()
    createAnnotationDto: {
      selectedText: string;
      comment?: string;
      aiResponse?: string;
      color: string;
      pageNumber: number;
      boundingRect: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        width: number;
        height: number;
        pageNumber: number;
      };
      rects?: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        width: number;
        height: number;
        pageNumber: number;
      }[];
      embedding?: string;
    },
  ) {
    if (createAnnotationDto.aiResponse) {
      const canUse = await this.subscriptionsService.canUseAiNote(userId);
      if (!canUse) {
        throw new ForbiddenException(
          'You have reached your AI notes limit. Upgrade your plan to continue.',
        );
      }
      await this.subscriptionsService.incrementAiNoteUsage(userId);
    }

    return this.annotationsService.create({
      ...createAnnotationDto,
      documentId,
      userId,
    });
  }

  @Patch('annotations/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string,
    @Body()
    updateAnnotationDto: {
      comment?: string;
      aiResponse?: string;
      color?: string;
      boundingRect?: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        width: number;
        height: number;
        pageNumber: number;
      };
      rects?: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        width: number;
        height: number;
        pageNumber: number;
      }[];
    },
  ) {
    if (updateAnnotationDto.aiResponse) {
      const canUse = await this.subscriptionsService.canUseAiNote(userId);
      if (!canUse) {
        throw new ForbiddenException(
          'You have reached your AI notes limit. Upgrade your plan to continue.',
        );
      }
      await this.subscriptionsService.incrementAiNoteUsage(userId);
    }

    return this.annotationsService.update(id, userId, updateAnnotationDto);
  }

  @Delete('annotations/:id')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string,
  ) {
    await this.annotationsService.delete(id, userId);
    return { success: true };
  }
}
