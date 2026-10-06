import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubscriptionPlan } from './Subscription.entity';
import type { PlanEntitlements } from '../../entitlements/catalog';

@Entity('plan')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    unique: true,
  })
  plan: SubscriptionPlan;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('boolean', { default: false })
  isPopular: boolean;

  // Everything the plan grants; editing this row changes every subscriber's limits at once.
  @Column('json', { nullable: true })
  entitlements: PlanEntitlements | null;

  @Column('boolean', { default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
