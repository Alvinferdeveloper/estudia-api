import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from '../typeorm/entities/Plan.entity';
import { SubscriptionPlan } from '../typeorm/entities/Subscription.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ErrorCode } from '../common/errors/error-codes';
import {
  isWithinLimit,
  type PlanCap,
  type PlanEntitlements,
  type PlanFeature,
  type PlanQuota,
} from './catalog';

export interface EffectiveEntitlements {
  plan: SubscriptionPlan;
  entitlements: PlanEntitlements;
  // The paid billing period in force; null on the free plan.
  billingPeriod: { start: Date; end: Date } | null;
}

@Injectable()
export class EntitlementsService {
  constructor(
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  // A paid plan applies until its period ends, even after cancelling; then the user is on free.
  async getEffective(userId: string): Promise<EffectiveEntitlements> {
    const subscription =
      await this.subscriptionsService.getOrCreateSubscription(userId);
    const isPaidPeriodCurrent =
      subscription.plan !== SubscriptionPlan.FREE &&
      !!subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd > new Date();

    const plan = isPaidPeriodCurrent ? subscription.plan : SubscriptionPlan.FREE;
    return {
      plan,
      entitlements: await this.getPlanEntitlements(plan),
      billingPeriod: isPaidPeriodCurrent
        ? {
            start: subscription.currentPeriodStart,
            end: subscription.currentPeriodEnd,
          }
        : null,
    };
  }

  // Read on every check, so editing a plan applies to its subscribers immediately.
  async getPlanEntitlements(plan: SubscriptionPlan): Promise<PlanEntitlements> {
    const row = await this.planRepository.findOne({ where: { plan } });
    if (!row?.entitlements) {
      throw new InternalServerErrorException({
        code: ErrorCode.PLAN_NOT_FOUND,
        message: `Plan ${plan} has no entitlements`,
      });
    }
    return row.entitlements;
  }

  async assertFeature(userId: string, feature: PlanFeature): Promise<void> {
    const { entitlements } = await this.getEffective(userId);
    if (!entitlements.features.includes(feature)) {
      throw new ForbiddenException({
        code: ErrorCode.FEATURE_NOT_AVAILABLE,
        params: { feature },
      });
    }
  }

  async assertCap(userId: string, cap: PlanCap, value: number): Promise<void> {
    const { entitlements } = await this.getEffective(userId);
    const max = entitlements.caps[cap];
    if (!isWithinLimit(max, value)) {
      throw new ForbiddenException({
        code: ErrorCode.CAP_EXCEEDED,
        params: { cap, max },
      });
    }
  }

  // `nextValue` is the usage the action would reach, e.g. current documents + 1.
  async assertQuota(
    userId: string,
    quota: PlanQuota,
    nextValue: number,
  ): Promise<void> {
    const { entitlements } = await this.getEffective(userId);
    const limit = entitlements.quotas[quota];
    if (!isWithinLimit(limit, nextValue)) {
      throw new ForbiddenException({
        code: ErrorCode.QUOTA_EXCEEDED,
        params: { quota, limit },
      });
    }
  }
}
