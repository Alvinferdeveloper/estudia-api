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

export interface AnnotationRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  pageNumber: number;
}

export interface BoundingRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  pageNumber: number;
}

@Entity('annotation')
export class Annotation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { name: 'selectedText', nullable: false })
  selectedText: string;

  @Column('text', { name: 'comment', nullable: true })
  comment: string | null;

  @Column('text', { name: 'aiResponse', nullable: true })
  aiResponse: string | null;

  @Column('int', { name: 'pageNumber', nullable: false })
  pageNumber: number;

  @Column('json', { name: 'boundingRect', nullable: false })
  boundingRect: BoundingRect;

  @Column('json', { name: 'rects', nullable: false })
  rects: AnnotationRect[];

  @Column('varchar', {
    name: 'color',
    nullable: false,
    length: 20,
    default: 'yellow',
  })
  color: string;

  @Column('text', { name: 'embedding', nullable: true })
  embedding: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  @ManyToOne(() => Document, (document) => document.annotations)
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @Column('text', { name: 'documentId', nullable: false })
  documentId: string;
}
