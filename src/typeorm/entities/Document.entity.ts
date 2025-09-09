import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './User.entity';
import { Topic } from './Topic.entity';
import { Message } from './Message.entity';

@Entity('document')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { name: 'fileName', nullable: false })
  fileName: string;

  @Column('varchar', { name: 'filePath', nullable: false, unique: true, length: 255 })
  filePath: string; // Path in Supabase Storage

  @Column('bigint', { name: 'fileSize', nullable: false })
  fileSize: number;

  @Column('varchar', { name: 'mimeType', nullable: false, length: 255 })
  mimeType: string;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => User, user => user.documents)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('text', { name: 'userId', nullable: false })
  userId: string;

  @ManyToOne(() => Topic, topic => topic.documents, { nullable: true })
  @JoinColumn({ name: 'topicId' })
  topic: Topic;

  @Column('text', { name: 'topicId', nullable: true })
  topicId: string;

  @Column('json', { name: 'tags', nullable: true })
  tags: string[];

  @OneToMany(() => Message, message => message.document)
  messages: Message[];
}

