import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Document } from './Document.entity';
import { Message } from './Message.entity';

@Entity('conversation')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { name: 'documentId', nullable: false })
  documentId: string;

  @Column('text', { name: 'userId', nullable: false })
  userId: string;

  @Column('varchar', { name: 'title', length: 255, default: 'Nueva conversación' })
  title: string;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => Document, (document) => document.conversations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];
}
