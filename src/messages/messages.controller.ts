import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ErrorCode } from '../common/errors/error-codes';

@Controller('documents/:documentId/messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Get()
  async getMessagesByDocument(
    @Param('documentId') documentId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.messagesService.getMessagesByDocument(documentId, userId);
  }

  @Post()
  async createMessageByDocument(
    @Param('documentId') documentId: string,
    @CurrentUserId() userId: string,
    @Body() createMessageDto: { role: 'user' | 'assistant'; content: string },
  ) {
    if (createMessageDto.role === 'assistant') {
      const canUse = await this.subscriptionsService.canUseChat(userId);
      if (!canUse) {
        throw new ForbiddenException({ code: ErrorCode.CHAT_LIMIT_REACHED });
      }
      await this.subscriptionsService.incrementChatUsage(userId);
    }

    return this.messagesService.createMessageByDocument(
      documentId,
      userId,
      createMessageDto,
    );
  }
}

@Controller('documents/:documentId/conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

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

  @Post(':conversationId/messages')
  async createMessage(
    @Param('documentId') documentId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUserId() userId: string,
    @Body() createMessageDto: { role: 'user' | 'assistant'; content: string },
  ) {
    if (createMessageDto.role === 'assistant') {
      const canUse = await this.subscriptionsService.canUseChat(userId);
      if (!canUse) {
        throw new ForbiddenException({ code: ErrorCode.CHAT_LIMIT_REACHED });
      }
      await this.subscriptionsService.incrementChatUsage(userId);
    }

    return this.messagesService.createMessage(
      documentId,
      conversationId,
      userId,
      createMessageDto,
    );
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
