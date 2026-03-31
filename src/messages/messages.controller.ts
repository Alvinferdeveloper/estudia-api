import { Controller, Get, Post, Body, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Controller('documents/:documentId/messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Get()
  async getMessages(
    @Param('documentId') documentId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.messagesService.getMessages(documentId, userId);
  }

  @Post()
  async createMessage(
    @Param('documentId') documentId: string,
    @CurrentUserId() userId: string,
    @Body() createMessageDto: { role: 'user' | 'assistant'; content: string },
  ) {
    if (createMessageDto.role === 'assistant') {
      const canUse = await this.subscriptionsService.canUseChat(userId);
      if (!canUse) {
        throw new ForbiddenException(
          'You have reached your chat message limit. Upgrade your plan to continue.',
        );
      }
      await this.subscriptionsService.incrementChatUsage(userId);
    }

    return this.messagesService.createMessage(documentId, userId, createMessageDto);
  }
}
