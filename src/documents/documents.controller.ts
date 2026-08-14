import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Body,
  Query,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';

@Controller('documents')
@UseGuards(AuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @CurrentUserId() userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('topicId') topicId?: string,
    @Body('folderId') folderId?: string,
    @Body('tags') tags?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    return this.documentsService.uploadDocument(
      file,
      userId,
      topicId,
      folderId,
      tags,
    );
  }

  @Get()
  async findAllDocuments(
    @CurrentUserId() userId: string,
    @Query('topicId') topicId?: string,
    @Query('folderId') folderId?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
  ) {
    return this.documentsService.findAllDocuments(
      userId,
      topicId,
      folderId,
      Number(page) || 1,
      Number(limit) || 10,
      search,
    );
  }

  @Get('items')
  async findAllItems(
    @CurrentUserId() userId: string,
    @Query('topicId') topicId?: string,
    @Query('folderId') folderId?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: 'date' | 'name',
  ) {
    return this.documentsService.findAllItems(
      userId,
      topicId,
      folderId,
      Number(page) || 1,
      Number(limit) || 10,
      search,
      sortBy === 'name' ? 'name' : 'date',
    );
  }

  @Get('recent')
  async findRecentDocuments(
    @CurrentUserId() userId: string,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
  ) {
    return this.documentsService.findRecentDocuments(
      userId,
      Number(limit) || 20,
      search,
    );
  }

  @Patch(':id/access')
  async touchDocument(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ) {
    await this.documentsService.touchDocument(id, userId);
    return { success: true };
  }

  @Patch(':id/star')
  async toggleDocumentStar(
    @Param('id') id: string,
    @Body('isStarred') isStarred: boolean,
    @CurrentUserId() userId: string,
  ) {
    await this.documentsService.toggleDocumentStar(id, userId, isStarred);
    return { success: true };
  }

  @Get(':id')
  async findOneDocument(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ) {
    return this.documentsService.findOneDocument(id, userId);
  }

  @Delete(':id')
  async deleteDocument(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ) {
    return this.documentsService.deleteDocument(id, userId);
  }
}
