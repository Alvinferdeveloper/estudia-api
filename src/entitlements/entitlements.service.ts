import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from '../typeorm/entities/Plan.entity';
import { SubscriptionPlan } from '../typeorm/entities/Subscription.entity';
import {
  SubscriptionsService,
  type EffectivePlan,
} from '../subscriptions/subscriptions.service';
import { ErrorCode } from '../common/errors/error-codes';
import {
  isWithinLimit,
  parsePlanEntitlements,
  type PlanCap,
  type PlanEntitlements,
  type PlanFeature,
  type PlanQuota,
} from './catalog';

export interface EffectiveEntitlements extends EffectivePlan {
  entitlements: PlanEntitlements;
}

@Injectable()
export class EntitlementsService {
  constructor(
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async getEffective(userId: string): Promise<EffectiveEntitlements> {
    const effective = await this.subscriptionsService.getEffectivePlan(userId);
    return {
      ...effective,
      entitlements: await this.getPlanEntitlements(effective.plan),
    };
  }

  // Read on every check, so editing a plan applies to its subscribers immediately.
  async getPlanEntitlements(plan: SubscriptionPlan): Promise<PlanEntitlements> {
    const row = await this.planRepository.findOne({ where: { plan } });
    const parsed = parsePlanEntitlements(row?.entitlements);
    if ('errors' in parsed) {
      throw new InternalServerErrorException({
        code: ErrorCode.PLAN_MISCONFIGURED,
        message: `Plan ${plan}: ${parsed.errors.join('; ')}`,
      });
    }
    return parsed.entitlements;
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

  // `next` holds the usage the action would reach, e.g. current documents + 1.
  async assertQuotas(
    userId: string,
    next: Partial<Record<PlanQuota, number>>,
  ): Promise<void> {
    const { entitlements } = await this.getEffective(userId);
    const entries = Object.entries(next) as [PlanQuota, number][];
    for (const [quota, value] of entries) {
      const limit = entitlements.quotas[quota];
      if (!isWithinLimit(limit, value)) {
        throw new ForbiddenException({
          code: ErrorCode.QUOTA_EXCEEDED,
          params: { quota, limit },
        });
      }
    }
  }
}
