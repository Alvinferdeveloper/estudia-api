import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';
import { ErrorCode } from '../common/errors/error-codes';

// Messages are written by the chat endpoint (ai/chat), never directly by the client.
@Controller('documents/:documentId/conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  async getConversations(
    @Param('documentId') documentId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.messagesService.getConversations(documentId, userId);
  }

  @Post()
  async createConversation(
    @Param('documentId') documentId: string,
    @CurrentUserId() userId: string,
    @Body() body: { title?: string },
  ) {
    return this.messagesService.createConversation(
      documentId,
      userId,
      body?.title,
    );
  }

  @Get(':conversationId/messages')
  async getMessages(
    @Param('documentId') documentId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.messagesService.getMessages(documentId, conversationId, userId);
  }

  @Patch(':conversationId')
  async renameConversation(
    @Param('conversationId') conversationId: string,
    @CurrentUserId() userId: string,
    @Body() body: { title: string },
  ) {
    if (!body?.title?.trim()) {
      throw new BadRequestException({
        code: ErrorCode.INVALID_REQUEST,
        message: 'Title is required',
      });
    }
    return this.messagesService.renameConversation(
      conversationId,
      userId,
      body.title,
    );
  }

  @Delete(':conversationId')
  async deleteConversation(
    @Param('conversationId') conversationId: string,
    @CurrentUserId() userId: string,
  ) {
    await this.messagesService.deleteConversation(conversationId, userId);
    return { success: true };
  }
}
