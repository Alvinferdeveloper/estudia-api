import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Plan } from '../typeorm/entities/Plan.entity';
import { SubscriptionPlan } from '../typeorm/entities/Subscription.entity';
import { UNLIMITED, type PlanEntitlements } from '../entitlements/catalog';

const MB = 1024 ** 2;
const GB = 1024 ** 3;

interface PlanDefaults {
  plan: SubscriptionPlan;
  price: number;
  isPopular: boolean;
  entitlements: PlanEntitlements;
}

// Placeholder values until the real pricing is set; production values are edited in the plan rows.
const DEFAULT_PLANS: PlanDefaults[] = [
  {
    plan: SubscriptionPlan.FREE,
    price: 0,
    isPopular: false,
    entitlements: {
      credits: { amount: 10, period: 'daily' },
      features: [],
      quotas: { documents: 3, storageBytes: 50 * MB },
      caps: { examQuestions: 5 },
    },
  },
  {
    plan: SubscriptionPlan.BASIC,
    price: 9.99,
    isPopular: true,
    entitlements: {
      credits: { amount: 300, period: 'monthly' },
      features: ['exportNotes'],
      quotas: { documents: 20, storageBytes: 500 * MB },
      caps: { examQuestions: 20 },
    },
  },
  {
    plan: SubscriptionPlan.PRO,
    price: 24.99,
    isPopular: false,
    entitlements: {
      credits: { amount: 1500, period: 'monthly' },
      features: ['exportNotes'],
      quotas: { documents: 100, storageBytes: 5 * GB },
      caps: { examQuestions: 20 },
    },
  },
  {
    plan: SubscriptionPlan.ENTERPRISE,
    price: 99,
    isPopular: false,
    entitlements: {
      credits: { amount: 10000, period: 'monthly' },
      features: ['exportNotes'],
      quotas: { documents: UNLIMITED, storageBytes: 50 * GB },
      caps: { examQuestions: 20 },
    },
  },
];

// Creates missing plans and fills missing entitlements; never overwrites values edited in the DB.
@Injectable()
export class PlansSeed implements OnModuleInit {
  private readonly logger = new Logger(PlansSeed.name);

  constructor(
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
  ) {}

  async onModuleInit() {
    for (const defaults of DEFAULT_PLANS) {
      const existing = await this.planRepository.findOne({
        where: { plan: defaults.plan },
      });

      if (!existing) {
        await this.planRepository.save(this.planRepository.create(defaults));
        this.logger.log(`Seeded plan ${defaults.plan}`);
      } else if (!existing.entitlements) {
        await this.planRepository.update(
          { plan: defaults.plan, entitlements: IsNull() },
          { entitlements: defaults.entitlements },
        );
        this.logger.log(`Filled entitlements for plan ${defaults.plan}`);
      }
    }
  }
}
