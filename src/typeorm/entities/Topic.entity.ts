import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './User.entity';
import { Document } from './Document.entity';

@Entity('topic')
export class Topic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { name: 'name', nullable: false, length: 255 })
  name: string;

  @Column('varchar', { name: 'color', nullable: true, length: 7 }) // e.g., #RRGGBB
  color: string;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => User, user => user.topics)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('text', { name: 'userId', nullable: false })
  userId: string;

  @OneToMany(() => Document, document => document.topic)
  documents: Document[];

  // This 'count' field will not be stored in the database.
  // It needs to be populated manually in queries or in the service layer.
  count?: number;
}
