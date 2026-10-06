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
  Query,
} from '@nestjs/common';
import { AnnotationsService } from './annotations.service';
import { RequireFeature } from '../entitlements/require-feature.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';

@Controller()
@UseGuards(AuthGuard)
export class AnnotationsController {
  constructor(private readonly annotationsService: AnnotationsService) {}

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

  @Get('documents/:documentId/annotations/export')
  @RequireFeature('exportNotes')
  async export(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Query('format')
    format: 'markdown' | 'json' | 'csv' | 'pdf' | 'anki' = 'markdown',
    @CurrentUserId() userId: string,
  ) {
    const annotations = await this.annotationsService.findByDocument(
      documentId,
      userId,
    );
    const document = await this.annotationsService.getDocument(
      documentId,
      userId,
    );

    return this.annotationsService.exportAnnotations(
      annotations,
      document,
      format,
    );
  }
}
