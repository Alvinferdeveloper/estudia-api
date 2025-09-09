import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';

@Controller('documents/:documentId/messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) { }

  @Get()
  async getMessages(
    @Param('documentId') documentId: string,
    @CurrentUserId() userId: string
  ) {
    return this.messagesService.getMessages(documentId, userId);
  }

  @Post()
  async createMessage(
    @Param('documentId') documentId: string,
    @CurrentUserId() userId: string,
    @Body() createMessageDto: { role: 'user' | 'assistant'; content: string }
  ) {
    return this.messagesService.createMessage(documentId, userId, createMessageDto);
  }
}
