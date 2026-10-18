import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Flashcard, FlashcardState } from './Flashcard.entity';

export enum FlashcardRating {
  AGAIN = 'again',
  HARD = 'hard',
  GOOD = 'good',
  EASY = 'easy',
}

// One rating of a card. Kept from the first review so FSRS can later be fitted to each user.
@Entity('flashcard_review')
@Index(['userId', 'reviewedAt'])
export class FlashcardReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { name: 'flashcardId', length: 36 })
  flashcardId: string;

  @Column('varchar', { name: 'userId', length: 36 })
  userId: string;

  @Column({ type: 'enum', enum: FlashcardRating })
  rating: FlashcardRating;

  // The card's memory state before this review.
  @Column({ type: 'enum', enum: FlashcardState })
  state: FlashcardState;

  @Column('double', { name: 'stability' })
  stability: number;

  @Column('double', { name: 'difficulty' })
  difficulty: number;

  @Column('int', { name: 'elapsedDays' })
  elapsedDays: number;

  @Column('int', { name: 'scheduledDays' })
  scheduledDays: number;

  @CreateDateColumn({ name: 'reviewedAt', type: 'timestamp' })
  reviewedAt: Date;

  @ManyToOne(() => Flashcard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flashcardId' })
  flashcard: Flashcard;
}
