import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

export enum PaymentProvider {
  PAYPAL = 'paypal',
}

export enum SubscriptionPlan {
  FREE = 'free',
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

@Entity('payment')
@Index(['userId', 'status'])
@Index(['paypalOrderId'])
@Index(['eventId'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'userId' })
  userId: string;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
  })
  plan: SubscriptionPlan;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column('varchar', { length: 3, default: 'USD' })
  currency: string;

  @Column('varchar', { length: 255, name: 'paypalOrderId', nullable: true })
  @Index()
  paypalOrderId: string | null;

  @Column('varchar', {
    length: 255,
    name: 'paypalSubscriptionId',
    nullable: true,
  })
  @Index()
  paypalSubscriptionId: string | null;

  @Column('varchar', { length: 255, name: 'paypalCaptureId', nullable: true })
  paypalCaptureId: string | null;

  @Column('varchar', { length: 255, name: 'paypalPayerId', nullable: true })
  paypalPayerId: string | null;

  @Column('varchar', { length: 255, name: 'paypalPayerEmail', nullable: true })
  paypalPayerEmail: string | null;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
    default: PaymentProvider.PAYPAL,
  })
  provider: PaymentProvider;

  @Column('varchar', { length: 255, name: 'eventId', nullable: true })
  eventId: string | null;

  @Column('varchar', { length: 500, nullable: true })
  failureReason: string | null;

  @Column('json', { nullable: true })
  metadata: Record<string, unknown>;

  @Column('timestamp', { name: 'completedAt', nullable: true })
  completedAt: Date | null;

  @Column('timestamp', { name: 'expiresAt', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
