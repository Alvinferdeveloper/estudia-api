import { Controller, Post, Get, Delete, UseInterceptors, UploadedFile, BadRequestException, UseGuards, Body, Query, Param } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';

@Controller('documents')
@UseGuards(AuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) { }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @CurrentUserId() userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('topicId') topicId?: string,
    @Body('tags') tags?: string, // tags as a comma-separated string
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    const tagsArray = tags ? tags.split(',').map(tag => tag.trim()) : [];

    return this.documentsService.uploadDocument(file, userId, topicId, tagsArray);
  }

  @Get()
  async findAllDocuments(@CurrentUserId() userId: string, @Query('topicId') topicId?: string) {
    return this.documentsService.findAllDocuments(userId, topicId);
  }

  @Get(':id')
  async findOneDocument(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.documentsService.findOneDocument(id, userId);
  }

  @Delete(':id')
  async deleteDocument(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.documentsService.deleteDocument(id, userId);
  }
}

