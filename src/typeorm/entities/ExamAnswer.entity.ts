import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ExamAttempt } from './ExamAttempt.entity';
import { ExamQuestion } from './ExamQuestion.entity';

// A graded answer to one question within one attempt.
@Entity('exam_answer')
@Unique(['attemptId', 'questionId'])
export class ExamAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { name: 'attemptId', length: 36 })
  attemptId: string;

  @Column('varchar', { name: 'questionId', length: 36 })
  questionId: string;

  @Column('text', { name: 'userAnswer' })
  userAnswer: string;

  // 0-10; null while a simulation awaits grading at the end.
  @Column('int', { name: 'score', nullable: true })
  score: number | null;

  @Column('text', { name: 'feedback', nullable: true })
  feedback: string | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => ExamAttempt, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attemptId' })
  attempt: ExamAttempt;

  @ManyToOne(() => ExamQuestion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId' })
  question: ExamQuestion;
}
