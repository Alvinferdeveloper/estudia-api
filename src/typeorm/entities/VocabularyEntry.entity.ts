import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Document } from './Document.entity';
import type { AnnotationRect, BoundingRect } from './Annotation.entity';

export interface VocabularyMeaning {
  partOfSpeech?: string;
  definition: string;
  exampleSentence: string;
  exampleTranslation?: string;
}

export interface VocabularyConfusable {
  word: string;
  explanation: string;
}

export interface VocabularyExplanation {
  word: string;
  wordLanguage: string;
  explanationLanguage: string;
  phonetic?: string;
  meanings: VocabularyMeaning[];
  confusables?: VocabularyConfusable[];
  tip?: string;
  synonyms?: string[];
}

@Entity('vocabulary_entry')
export class VocabularyEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { name: 'selectedText', nullable: false })
  selectedText: string;

  @Column('varchar', { name: 'wordLanguage', nullable: false, length: 10 })
  wordLanguage: string;

  @Column('varchar', {
    name: 'explanationLanguage',
    nullable: false,
    length: 10,
  })
  explanationLanguage: string;

  @Column('varchar', {
    name: 'color',
    nullable: false,
    length: 20,
    default: '#B39DDB',
  })
  color: string;

  @Column('int', { name: 'pageNumber', nullable: false })
  pageNumber: number;

  @Column('json', { name: 'boundingRect', nullable: false })
  boundingRect: BoundingRect;

  @Column('json', { name: 'rects', nullable: false })
  rects: AnnotationRect[];

  @Column('json', { name: 'explanation', nullable: true })
  explanation: VocabularyExplanation | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  @ManyToOne(() => Document, (document) => document.vocabularyEntries)
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @Column('text', { name: 'documentId', nullable: false })
  documentId: string;
}
