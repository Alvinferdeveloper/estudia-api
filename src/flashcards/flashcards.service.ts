import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Flashcard,
  FlashcardSource,
} from '../typeorm/entities/Flashcard.entity';
import { Document } from '../typeorm/entities/Document.entity';
import { ErrorCode } from '../common/errors/error-codes';
import { CreateFlashcardDto, UpdateFlashcardDto } from './dto/flashcard.dto';

@Injectable()
export class FlashcardsService {
  constructor(
    @InjectRepository(Flashcard)
    private readonly flashcardRepository: Repository<Flashcard>,
  ) {}

  async findByDocument(
    userId: string,
    documentId: string,
  ): Promise<Flashcard[]> {
    await this.verifyDocumentAccess(documentId, userId);
    return this.flashcardRepository.find({
      where: { documentId, userId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    userId: string,
    documentId: string,
    dto: CreateFlashcardDto,
  ): Promise<Flashcard> {
    await this.verifyDocumentAccess(documentId, userId);
    return this.flashcardRepository.save(
      this.flashcardRepository.create({
        userId,
        documentId,
        source: FlashcardSource.MANUAL,
        front: dto.front,
        back: dto.back,
        pageNumber: dto.pageNumber ?? null,
      }),
    );
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateFlashcardDto,
  ): Promise<Flashcard> {
    const card = await this.getOwned(userId, id);
    return this.flashcardRepository.save(
      this.flashcardRepository.merge(card, dto),
    );
  }

  async delete(userId: string, id: string): Promise<void> {
    const card = await this.getOwned(userId, id);
    await this.flashcardRepository.delete(card.id);
  }

  private async getOwned(userId: string, id: string): Promise<Flashcard> {
    const card = await this.flashcardRepository.findOneBy({ id, userId });
    if (!card) {
      throw new NotFoundException({ code: ErrorCode.FLASHCARD_NOT_FOUND });
    }
    return card;
  }

  private async verifyDocumentAccess(
    documentId: string,
    userId: string,
  ): Promise<void> {
    const exists = await this.flashcardRepository.manager.existsBy(Document, {
      id: documentId,
      userId,
    });
    if (!exists) {
      throw new ForbiddenException({ code: ErrorCode.DOCUMENT_ACCESS_DENIED });
    }
  }
}
