import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubscriptionPlan } from './Subscription.entity';

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

  @Column('varchar', { length: 50 })
  name: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('text')
  description: string;

  @Column('json', { nullable: true })
  features: string[];

  @Column('boolean', { default: false })
  isPopular: boolean;

  @Column('integer', { name: 'chatMessagesLimit', default: 0 })
  chatMessagesLimit: number;

  @Column('integer', { name: 'aiNotesLimit', default: 0 })
  aiNotesLimit: number;

  @Column('integer', { name: 'documentsLimit', default: 0 })
  documentsLimit: number;

  @Column('bigint', { name: 'storageLimitBytes', default: 0 })
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

  @Column('boolean', { default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
