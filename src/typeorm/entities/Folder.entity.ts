import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './User.entity';
import { Topic } from './Topic.entity';
import { Document } from './Document.entity';

@Entity('folder')
export class Folder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { name: 'name', nullable: false, length: 255 })
  name: string;

  @Column('varchar', { name: 'color', nullable: true, length: 7 })
  color: string;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => User, user => user.folders)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('text', { name: 'userId', nullable: false })
  userId: string;

  @ManyToOne(() => Topic, topic => topic.folders, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topicId' })
  topic: Topic;

  @Column('text', { name: 'topicId', nullable: true })
  topicId: string;

  @ManyToOne(() => Folder, folder => folder.subfolders, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentId' })
  parent: Folder;

  @Column('text', { name: 'parentId', nullable: true })
  parentId: string;

  @OneToMany(() => Folder, folder => folder.parent)
  subfolders: Folder[];

  @OneToMany(() => Document, document => document.folder)
  documents: Document[];

  count?: number;
  subfoldersCount?: number;
}
