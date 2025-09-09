import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../typeorm/entities/Message.entity';
import { Document } from '../typeorm/entities/Document.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
  ) { }

  async getMessages(documentId: string, userId: string): Promise<Message[]> {
    await this.verifyDocumentAccess(documentId, userId);
    return this.messagesRepository.find({ where: { documentId }, order: { createdAt: 'ASC' } });
  }

  async createMessage(
    documentId: string,
    userId: string,
    createMessageDto: { role: 'user' | 'assistant'; content: string }
  ): Promise<Message> {
    await this.verifyDocumentAccess(documentId, userId);
    const newMessage = this.messagesRepository.create({ ...createMessageDto, documentId });
    return this.messagesRepository.save(newMessage);
  }

  private async verifyDocumentAccess(documentId: string, userId: string): Promise<void> {
    const document = await this.documentsRepository.findOne({ where: { id: documentId, userId } });
    if (!document) {
      throw new UnauthorizedException('Access to this document is denied');
    }
  }
}
