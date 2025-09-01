import { Column, Entity, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Document } from './Document.entity';
import { Topic } from './Topic.entity';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { name: 'name', nullable: false })
  name: string;

  @Column('varchar', { name: 'email', nullable: false, unique: true, length: 255 })
  email: string;

  @Column('integer', { name: 'emailVerified', nullable: false })
  emailVerified: boolean;

  @Column('text', { name: 'image', nullable: true })
  image: string;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => Document, document => document.user)
  documents: Document[];

  @OneToMany(() => Topic, topic => topic.user)
  topics: Topic[];
}