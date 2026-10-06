import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Append-only history of credit movements: charges are negative, refunds and grants positive.
@Entity('credit_ledger')
@Index(['userId', 'createdAt'])
export class CreditLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { name: 'userId', length: 36 })
  userId: string;

  @Column('varchar', { name: 'action', length: 48 })
  action: string;

  @Column('int', { name: 'credits' })
  credits: number;

  @Column('varchar', { name: 'periodKey', length: 16 })
  periodKey: string;

  // Action params (e.g. exam size) or, for a refund, the entry it reverses.
  @Column('json', { name: 'metadata', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamp' })
  createdAt: Date;
}
