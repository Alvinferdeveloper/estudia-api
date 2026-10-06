import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// One row per model call: what it really cost us, as opposed to the credits the user was charged.
@Entity('ai_call_log')
@Index(['userId', 'createdAt'])
export class AICallLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Null for calls outside a user action (e.g. background jobs).
  @Column('varchar', { name: 'userId', length: 36, nullable: true })
  userId: string | null;

  // Links the call to the credit charge that triggered it.
  @Index()
  @Column('varchar', { name: 'ledgerEntryId', length: 36, nullable: true })
  ledgerEntryId: string | null;

  @Column('varchar', { name: 'feature', length: 32 })
  feature: string;

  @Column('varchar', { name: 'model', length: 64, nullable: true })
  model: string | null;

  @Column('int', { name: 'inputTokens', default: 0 })
  inputTokens: number;

  @Column('int', { name: 'outputTokens', default: 0 })
  outputTokens: number;

  @Column('int', { name: 'reasoningTokens', default: 0 })
  reasoningTokens: number;

  // Priced at call time, so later price changes don't rewrite history.
  @Column('decimal', {
    name: 'costUsd',
    precision: 12,
    scale: 6,
    nullable: true,
  })
  costUsd: string | null;

  @Column('int', { name: 'durationMs' })
  durationMs: number;

  @Column('boolean', { name: 'success' })
  success: boolean;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamp' })
  createdAt: Date;
}
