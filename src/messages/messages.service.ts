import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../typeorm/entities/Message.entity';
import { Conversation } from '../typeorm/entities/Conversation.entity';
import { Document } from '../typeorm/entities/Document.entity';
import { ErrorCode } from '../common/errors/error-codes';

const DEFAULT_TITLE = 'Nueva conversación';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private conversationsRepository: Repository<Conversation>,
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
  ) {}

  // ─── Conversations ─────────────────────────────────────────────

  async getConversations(
    documentId: string,
    userId: string,
  ): Promise<Conversation[]> {
    await this.verifyDocumentAccess(documentId, userId);
    return this.conversationsRepository.find({
      where: { documentId, userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async createConversation(
    documentId: string,
    userId: string,
    title?: string,
  ): Promise<Conversation> {
    await this.verifyDocumentAccess(documentId, userId);
    const conversation = this.conversationsRepository.create({
      documentId,
      userId,
      title: title?.trim() || DEFAULT_TITLE,
    });
    return this.conversationsRepository.save(conversation);
  }

  async renameConversation(
    conversationId: string,
    userId: string,
    title: string,
  ): Promise<Conversation> {
    const conversation = await this.findOwnedConversation(
      conversationId,
      userId,
    );
    conversation.title = title.trim() || DEFAULT_TITLE;
    return this.conversationsRepository.save(conversation);
  }

  async deleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const conversation = await this.findOwnedConversation(
      conversationId,
      userId,
    );
    await this.conversationsRepository.remove(conversation);
  }

  // ─── Messages (conversation scoped) ────────────────────────────

  async getMessages(
    documentId: string,
    conversationId: string,
    userId: string,
  ): Promise<Message[]> {
    await this.verifyConversationAccess(conversationId, documentId, userId);
    return this.messagesRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
  }

  async createMessage(
    documentId: string,
    conversationId: string,
    userId: string,
    createMessageDto: { role: 'user' | 'assistant'; content: string },
  ): Promise<Message> {
    const conversation = await this.verifyConversationAccess(
      conversationId,
      documentId,
      userId,
    );

    const message = this.messagesRepository.create({
      role: createMessageDto.role,
      content: createMessageDto.content,
      documentId,
      conversationId,
    });

    const update: Partial<Conversation> = { updatedAt: new Date() };

    if (
      createMessageDto.role === 'user' &&
      conversation.title === DEFAULT_TITLE
    ) {
      const count = await this.messagesRepository.count({
        where: { conversationId },
      });
      if (count === 0) {
        update.title = this.deriveTitle(createMessageDto.content);
      }
    }

    const saved = await this.messagesRepository.save(message);
    await this.conversationsRepository.update(conversationId, update);
    return saved;
  }

  // ─── Legacy (single flat chat, kept for compatibility) ─────────

  async getMessagesByDocument(
    documentId: string,
    userId: string,
  ): Promise<Message[]> {
    await this.verifyDocumentAccess(documentId, userId);
    return this.messagesRepository.find({
      where: { documentId },
      order: { createdAt: 'ASC' },
    });
  }

  async createMessageByDocument(
    documentId: string,
    userId: string,
    createMessageDto: { role: 'user' | 'assistant'; content: string },
  ): Promise<Message> {
    await this.verifyDocumentAccess(documentId, userId);
    const newMessage = this.messagesRepository.create({
      role: createMessageDto.role,
      content: createMessageDto.content,
      documentId,
    });
    return this.messagesRepository.save(newMessage);
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private deriveTitle(content: string): string {
    const clean = content.replace(/\s+/g, ' ').trim();
    if (clean.length <= 50) return clean || DEFAULT_TITLE;
    return clean.slice(0, 50).trimEnd() + '…';
  }

  private async findOwnedConversation(
    conversationId: string,
    userId: string,
  ): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: conversationId },
    });
    if (!conversation || conversation.userId !== userId) {
      throw new NotFoundException({ code: ErrorCode.CONVERSATION_NOT_FOUND });
    }
    return conversation;
  }

  private async verifyConversationAccess(
    conversationId: string,
    documentId: string,
    userId: string,
  ): Promise<Conversation> {
    const conversation = await this.findOwnedConversation(
      conversationId,
      userId,
    );
    if (conversation.documentId !== documentId) {
      throw new UnauthorizedException({
        code: ErrorCode.CONVERSATION_NOT_FOUND,
        message: 'Conversation does not belong to document',
      });
    }
    return conversation;
  }

  private async verifyDocumentAccess(
    documentId: string,
    userId: string,
  ): Promise<void> {
    const document = await this.documentsRepository.findOne({
      where: { id: documentId, userId },
    });
    if (!document) {
      throw new UnauthorizedException({
        code: ErrorCode.DOCUMENT_ACCESS_DENIED,
      });
    }
  }
}
