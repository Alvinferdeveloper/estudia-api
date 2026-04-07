import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Exam } from './Exam.entity';

@Entity('exam_result')
export class ExamResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'examId' })
  examId: string;

  @Column({ type: 'int', nullable: true })
  score: number | null;

  @Column({ type: 'int', default: 0 })
  correctAnswers: number;

  @Column({ type: 'int', default: 0 })
  totalQuestions: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => Exam, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'examId' })
  exam: Exam;
}