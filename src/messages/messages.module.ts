import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../typeorm/entities/Message.entity';
import { Document } from '../typeorm/entities/Document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Message, Document])],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService]
})
export class MessagesModule { }
