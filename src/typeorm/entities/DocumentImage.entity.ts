import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Document } from './Document.entity';

@Entity('document_images')
export class DocumentImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @Column('text', { name: 'documentId', nullable: false })
  @Index()
  documentId: string;

  @Column('int', { name: 'pageNumber', nullable: false })
  pageNumber: number;

  @Column('int', { name: 'xref', nullable: false })
  xref: number;

  @Column('float', { name: 'bboxX0', nullable: false })
  bboxX0: number;

  @Column('float', { name: 'bboxY0', nullable: false })
  bboxY0: number;

  @Column('float', { name: 'bboxX1', nullable: false })
  bboxX1: number;

  @Column('float', { name: 'bboxY1', nullable: false })
  bboxY1: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;
}
