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

  @Column('boolean', { default: true })
  isActive: boolean;

  @Column('timestamp', { name: 'currentPeriodStart', nullable: true })
  currentPeriodStart: Date;

  @Column('timestamp', { name: 'currentPeriodEnd', nullable: true })
  currentPeriodEnd: Date;

  @Column('integer', { name: 'chatMessagesUsed', default: 0 })
  chatMessagesUsed: number;

  @Column('integer', { name: 'chatMessagesLimit', default: 30 })
  chatMessagesLimit: number;

  @Column('integer', { name: 'aiNotesUsed', default: 0 })
  aiNotesUsed: number;

  @Column('integer', { name: 'aiNotesLimit', default: 20 })
  aiNotesLimit: number;

  @Column('integer', { name: 'documentsLimit', default: 3 })
  documentsLimit: number;

  @Column('bigint', { name: 'storageLimitBytes', default: 52428800 })
  storageLimitBytes: number;

  @Column('boolean', { name: 'hasSemanticSearch', default: false })
  hasSemanticSearch: boolean;

  @Column('boolean', { name: 'hasVectorization', default: false })
  hasVectorization: boolean;

  @Column('boolean', { name: 'hasAdvancedModels', default: false })
  hasAdvancedModels: boolean;

  @Column('boolean', { name: 'hasExportNotes', default: false })
  hasExportNotes: boolean;

  @Column('boolean', { name: 'hasApiAccess', default: false })
  hasApiAccess: boolean;

  @Column('text', { name: 'stripeCustomerId', nullable: true })
  stripeCustomerId: string;

  @Column('text', { name: 'stripeSubscriptionId', nullable: true })
  stripeSubscriptionId: string;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
