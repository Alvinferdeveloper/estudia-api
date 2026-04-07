import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User.entity';
import { Document } from './Document.entity';

export enum ExamMode {
  QUICK_REVIEW = 'quick_review',
  EXAM_SIMULATION = 'exam_simulation',
  CUSTOM = 'custom',
}

export enum QuestionType {
  OPEN = 'open',
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
  FILL_BLANK = 'fill_blank',
  MIXED = 'mixed',
}

@Entity('exam')
export class Exam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'userId' })
  userId: string;

  @Column({ name: 'documentId' })
  documentId: string;

  @Column('simple-array', { name: 'pages', nullable: true })
  pages: number[];

  @Column({ type: 'enum', enum: ExamMode, default: ExamMode.QUICK_REVIEW })
  mode: ExamMode;

  @Column({ type: 'int', default: 0 })
  totalQuestions: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string;

  @Column({ name: 'difficulty', default: 'medium' })
  difficulty: string;

  @Column({ type: 'enum', enum: QuestionType, default: QuestionType.OPEN })
  questionType: QuestionType;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Document)
  @JoinColumn({ name: 'documentId' })
  document: Document;
}
