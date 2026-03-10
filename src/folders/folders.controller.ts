import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { FoldersService } from './folders.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';

@Controller('folders')
@UseGuards(AuthGuard)
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) { }

  @Post()
  async createFolder(
    @Body('name') name: string,
    @Body('color') color: string,
    @Body('topicId') topicId: string,
    @Body('parentId') parentId: string | undefined,
    @CurrentUserId() userId: string
  ) {
    return this.foldersService.createFolder(name, color, topicId, userId, parentId);
  }

  @Get()
  async findAllFolders(
    @CurrentUserId() userId: string,
    @Query('topicId') topicId?: string
  ) {
    return this.foldersService.findAllFolders(userId, topicId);
  }

  @Get('topic/:topicId')
  async findFoldersByTopic(
    @Param('topicId') topicId: string,
    @CurrentUserId() userId: string
  ) {
    return this.foldersService.findFoldersByTopic(topicId, userId);
  }

  @Get('root/:topicId')
  async findRootFolders(
    @Param('topicId') topicId: string,
    @CurrentUserId() userId: string
  ) {
    return this.foldersService.findRootFolders(topicId, userId);
  }

  @Get(':id')
  async findOneFolder(@Param('id') id: string, @CurrentUserId() userId: string) {
    const folder = await this.foldersService.findOneFolder(id, userId);
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }
    return folder;
  }

  @Put(':id')
  async updateFolder(
    @Param('id') id: string,
    @Body('name') name: string,
    @Body('color') color: string,
    @CurrentUserId() userId: string
  ) {
    return this.foldersService.updateFolder(id, name, color, userId);
  }

  @Delete(':id')
  async removeFolder(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.foldersService.removeFolder(id, userId);
  }
}
