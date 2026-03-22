import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Document } from './Document.entity';

@Entity('message')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { name: 'role', nullable: false })
  role: 'user' | 'assistant';

  @Column('text', { name: 'content', nullable: false })
  content: string;

  @Column('text', { name: 'documentId', nullable: false })
  documentId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Document, (document) => document.messages)
  @JoinColumn({ name: 'documentId' })
  document: Document;
}
