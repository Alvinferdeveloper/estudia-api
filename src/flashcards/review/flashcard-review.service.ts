import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import {
  Flashcard,
  FlashcardState,
} from '../../typeorm/entities/Flashcard.entity';
import {
  FlashcardRating,
  FlashcardReview,
} from '../../typeorm/entities/FlashcardReview.entity';
import { ErrorCode } from '../../common/errors/error-codes';
import { startOfUtcDay } from '../../common/utils/utc-day.util';
import {
  MAX_NEW_CARDS_PER_DAY,
  applyReview,
  previewReview,
} from './fsrs-scheduler';

export type DueFlashcard = Flashcard & {
  preview: Record<FlashcardRating, Date>;
};

@Injectable()
export class FlashcardReviewService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Flashcard)
    private readonly flashcardRepository: Repository<Flashcard>,
    @InjectRepository(FlashcardReview)
    private readonly reviewRepository: Repository<FlashcardReview>,
  ) {}

  // Cards already in progress first, then as many new ones as today's limit allows.
  async findDue(userId: string, documentId?: string): Promise<DueFlashcard[]> {
    const now = new Date();
    const newSlots = await this.newCardSlots(userId, now);
    const [started, fresh] = await Promise.all([
      this.dueQuery(userId, documentId, now)
        .andWhere('card.state != :new', { new: FlashcardState.NEW })
        .orderBy('card.due', 'ASC')
        .getMany(),
      newSlots > 0
        ? this.dueQuery(userId, documentId, now)
            .andWhere('card.state = :new', { new: FlashcardState.NEW })
            .orderBy('card.createdAt', 'ASC')
            .take(newSlots)
            .getMany()
        : [],
    ]);
    return [...started, ...fresh].map((card) => withPreview(card, now));
  }

  async summary(
    userId: string,
    documentId?: string,
  ): Promise<{ total: number; due: number }> {
    const now = new Date();
    const [total, started, fresh, newSlots] = await Promise.all([
      this.flashcardRepository.countBy({
        userId,
        ...(documentId && { documentId }),
      }),
      this.dueQuery(userId, documentId, now)
        .andWhere('card.state != :new', { new: FlashcardState.NEW })
        .getCount(),
      this.dueQuery(userId, documentId, now)
        .andWhere('card.state = :new', { new: FlashcardState.NEW })
        .getCount(),
      this.newCardSlots(userId, now),
    ]);
    return { total, due: started + Math.min(fresh, newSlots) };
  }

  async review(
    userId: string,
    id: string,
    rating: FlashcardRating,
  ): Promise<DueFlashcard> {
    const now = new Date();
    const card = await this.dataSource.transaction(async (manager) => {
      // The lock keeps a double submission from applying the same review twice.
      const current = await manager.findOne(Flashcard, {
        where: { id, userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current) {
        throw new NotFoundException({ code: ErrorCode.FLASHCARD_NOT_FOUND });
      }
      const { memory, log } = applyReview(current, rating, now);
      await manager.save(
        manager.create(FlashcardReview, {
          flashcardId: current.id,
          userId,
          rating,
          ...log,
        }),
      );
      return manager.save(Object.assign(current, memory));
    });
    return withPreview(card, now);
  }

  private dueQuery(userId: string, documentId: string | undefined, now: Date) {
    const query = this.flashcardRepository
      .createQueryBuilder('card')
      .where('card.userId = :userId', { userId })
      .andWhere('card.due <= :now', { now });
    if (documentId) {
      query.andWhere('card.documentId = :documentId', { documentId });
    }
    return query;
  }

  // The limit is per user, whichever documents the new cards come from.
  private async newCardSlots(userId: string, now: Date): Promise<number> {
    const startedToday = await this.reviewRepository.countBy({
      userId,
      state: FlashcardState.NEW,
      reviewedAt: MoreThanOrEqual(startOfUtcDay(now)),
    });
    return Math.max(MAX_NEW_CARDS_PER_DAY - startedToday, 0);
  }
}

const withPreview = (card: Flashcard, now: Date): DueFlashcard => ({
  ...card,
  preview: previewReview(card, now),
});
