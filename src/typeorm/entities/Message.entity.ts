import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Document } from './Document.entity';
import { Conversation } from './Conversation.entity';

// A passage a reply was grounded on; the reply cites it as [n], its 1-based position.
export interface ChatSource {
  pageNumber: number;
  content: string;
}

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

  // Only on assistant replies that had document context.
  @Column('json', { name: 'sources', nullable: true })
  sources: ChatSource[] | null;

  @Column('uuid', { name: 'conversationId', nullable: true })
  conversationId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Document, (document) => document.messages)
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;
}
