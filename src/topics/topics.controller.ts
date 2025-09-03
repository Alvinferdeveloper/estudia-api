import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { TopicsService } from './topics.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { Request } from 'express';
import { CurrentUserId } from '../common/decorators/user.decorator';

@Controller('topics')
@UseGuards(AuthGuard)
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) { }

  @Post()
  async createTopic(@Body('name') name: string, @Body('color') color: string, @CurrentUserId() userId: string) {
    return this.topicsService.createTopic(name, color, userId);
  }

  @Get()
  async findAllTopics(@CurrentUserId() userId: string) {
    return this.topicsService.findAllTopics(userId);
  }

  @Get(':id')
  async findOneTopic(@Param('id') id: string, @CurrentUserId() userId: string) {
    const topic = await this.topicsService.findOneTopic(id, userId);
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }
    return topic;
  }

  @Put(':id')
  async updateTopic(@Param('id') id: string, @Body('name') name: string, @Body('color') color: string, @CurrentUserId() userId: string) {
    return this.topicsService.updateTopic(id, name, color, userId);
  }

  @Delete(':id')
  async removeTopic(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.topicsService.removeTopic(id, userId);
  }
}
