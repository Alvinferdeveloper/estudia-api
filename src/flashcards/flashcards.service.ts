import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  Flashcard,
  FlashcardSource,
} from '../typeorm/entities/Flashcard.entity';
import { Document } from '../typeorm/entities/Document.entity';
import { VocabularyEntry } from '../typeorm/entities/VocabularyEntry.entity';
import { ErrorCode } from '../common/errors/error-codes';
import { CreateFlashcardDto, UpdateFlashcardDto } from './dto/flashcard.dto';
import { vocabularyCard } from './flashcard-templates';

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

  // Saved words that have no card yet (all of them, or only the given ones) get one.
  async addVocabulary(
    userId: string,
    documentId: string,
    vocabularyEntryIds?: string[],
  ): Promise<{ added: number }> {
    await this.verifyDocumentAccess(documentId, userId);
    const entries = await this.flashcardRepository.manager.findBy(
      VocabularyEntry,
      {
        documentId,
        ...(vocabularyEntryIds && { id: In(vocabularyEntryIds) }),
      },
    );
    if (entries.length === 0) return { added: 0 };

    const carded = await this.flashcardRepository.find({
      select: { vocabularyEntryId: true },
      where: { vocabularyEntryId: In(entries.map((entry) => entry.id)) },
    });
    const cardedIds = new Set(carded.map((card) => card.vocabularyEntryId));

    const cards = entries
      .filter((entry) => !cardedIds.has(entry.id))
      .flatMap((entry) => {
        const card = vocabularyCard(entry);
        return card
          ? [
              {
                ...card,
                userId,
                documentId,
                source: FlashcardSource.VOCABULARY,
                vocabularyEntryId: entry.id,
                pageNumber: entry.pageNumber,
              },
            ]
          : [];
      });
    if (cards.length === 0) return { added: 0 };

    // A concurrent request may have added some of them; the unique index skips those.
    const result = await this.flashcardRepository
      .createQueryBuilder()
      .insert()
      .values(cards)
      .orIgnore()
      .execute();
    return { added: result.raw.affectedRows ?? cards.length };
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
