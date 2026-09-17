import { Module } from '@nestjs/common';
import {
  MessagesController,
  ConversationsController,
} from './messages.controller';
import { MessagesService } from './messages.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../typeorm/entities/Message.entity';
import { Document } from '../typeorm/entities/Document.entity';
import { Conversation } from '../typeorm/entities/Conversation.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Document, Conversation]),
    SubscriptionsModule,
  ],
  controllers: [MessagesController, ConversationsController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
