import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Exam, QuestionType } from './Exam.entity';

@Entity('exam_question')
export class ExamQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'examId' })
  examId: string;

  @Column({ type: 'int' })
  order: number;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'enum', enum: QuestionType, nullable: true })
  type: QuestionType | null;

  @Column({ type: 'text', nullable: true })
  options: string | null;

  @Column({ type: 'text', nullable: true })
  idealAnswer: string | null;

  @ManyToOne(() => Exam, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'examId' })
  exam: Exam;
}