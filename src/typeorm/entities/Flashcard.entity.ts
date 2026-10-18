import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Document } from './Document.entity';
import { Annotation } from './Annotation.entity';
import { VocabularyEntry } from './VocabularyEntry.entity';

export enum FlashcardSource {
  VOCABULARY = 'vocabulary',
  NOTE = 'note',
  MANUAL = 'manual',
}

// Where a card is in spaced repetition (FSRS).
export enum FlashcardState {
  NEW = 'new',
  LEARNING = 'learning',
  REVIEW = 'review',
  RELEARNING = 'relearning',
}

// A question/answer card from a document. Only ever created by an explicit user action.
@Entity('flashcard')
@Index(['documentId', 'createdAt'])
@Index(['userId', 'due'])
export class Flashcard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { name: 'userId', length: 36 })
  userId: string;

  @Column('varchar', { name: 'documentId', length: 36 })
  documentId: string;

  // Kept after the origin note is deleted, so the card still says where it came from.
  @Column({ type: 'enum', enum: FlashcardSource })
  source: FlashcardSource;

  // Unique: a saved word has at most one card, and deleting the word deletes it.
  @Column('varchar', {
    name: 'vocabularyEntryId',
    length: 36,
    nullable: true,
    unique: true,
  })
  vocabularyEntryId: string | null;

  // Deleting the note keeps its cards, detached.
  @Column('varchar', { name: 'annotationId', length: 36, nullable: true })
  annotationId: string | null;

  @Column('text', { name: 'front' })
  front: string;

  // Markdown.
  @Column('text', { name: 'back' })
  back: string;

  @Column('int', { name: 'pageNumber', nullable: true })
  pageNumber: number | null;

  // FSRS memory state. A new card is due as soon as it exists.
  @Column('timestamp', { name: 'due', default: () => 'CURRENT_TIMESTAMP' })
  due: Date;

  @Column({ type: 'enum', enum: FlashcardState, default: FlashcardState.NEW })
  state: FlashcardState;

  @Column('double', { name: 'stability', default: 0 })
  stability: number;

  @Column('double', { name: 'difficulty', default: 0 })
  difficulty: number;

  @Column('int', { name: 'scheduledDays', default: 0 })
  scheduledDays: number;

  @Column('int', { name: 'learningSteps', default: 0 })
  learningSteps: number;

  @Column('int', { name: 'reps', default: 0 })
  reps: number;

  @Column('int', { name: 'lapses', default: 0 })
  lapses: number;

  @Column('timestamp', { name: 'lastReviewedAt', nullable: true })
  lastReviewedAt: Date | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @ManyToOne(() => VocabularyEntry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vocabularyEntryId' })
  vocabularyEntry: VocabularyEntry | null;

  @ManyToOne(() => Annotation, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'annotationId' })
  annotation: Annotation | null;
}
