import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User.entity';

export enum SubscriptionPlan {
  FREE = 'free',
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

@Entity('subscription')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'userId', unique: true })
  userId: string;

  @OneToOne(() => User, (user) => user.subscription)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.FREE,
  })
  plan: SubscriptionPlan;

  // False once renewals stop; the plan still applies until currentPeriodEnd.
  @Column('boolean', { default: true })
  isActive: boolean;

  @Column('timestamp', { name: 'currentPeriodStart', nullable: true })
  currentPeriodStart: Date;

  @Column('timestamp', { name: 'currentPeriodEnd', nullable: true })
  currentPeriodEnd: Date;

  @Column('text', { name: 'paypalSubscriptionId', nullable: true })
  paypalSubscriptionId: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
