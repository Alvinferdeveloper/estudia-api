import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Credits spent per user and period. A new period is a new row, so balances reset without a job.
@Entity('credit_usage')
export class CreditUsage {
  @PrimaryColumn('varchar', { name: 'userId', length: 36 })
  userId: string;

  // e.g. "d:2026-10-05" (daily) or "m:2026-10-05" (cycle starting that day).
  @PrimaryColumn('varchar', { name: 'periodKey', length: 16 })
  periodKey: string;

  @Column('int', { name: 'used', default: 0 })
  used: number;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamp' })
  updatedAt: Date;
}
