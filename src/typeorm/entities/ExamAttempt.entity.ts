import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exam } from './Exam.entity';

export enum ExamAttemptMode {
  PRACTICE = 'practice',
  SIMULATION = 'simulation',
}

export enum ExamAttemptStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

// One sitting of an exam. Answers are saved as they are given, so a reload resumes it.
@Entity('exam_attempt')
@Index(['examId', 'startedAt'])
export class ExamAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { name: 'examId', length: 36 })
  examId: string;

  @Column('varchar', { name: 'userId', length: 36 })
  userId: string;

  @Column({ type: 'enum', enum: ExamAttemptMode })
  mode: ExamAttemptMode;

  @Column({
    type: 'enum',
    enum: ExamAttemptStatus,
    default: ExamAttemptStatus.IN_PROGRESS,
  })
  status: ExamAttemptStatus;

  @CreateDateColumn({ name: 'startedAt', type: 'timestamp' })
  startedAt: Date;

  @Column('timestamp', { name: 'finishedAt', nullable: true })
  finishedAt: Date | null;

  // 0-100, set when the attempt is finished.
  @Column('int', { name: 'score', nullable: true })
  score: number | null;

  @Column('int', { name: 'correctAnswers', default: 0 })
  correctAnswers: number;

  @Column('int', { name: 'totalQuestions' })
  totalQuestions: number;

  // Simulations only; the deadline is startedAt plus this.
  @Column('int', { name: 'timeLimitSeconds', nullable: true })
  timeLimitSeconds: number | null;

  @ManyToOne(() => Exam, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'examId' })
  exam: Exam;
}
