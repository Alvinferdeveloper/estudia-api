import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Subscription,
  SubscriptionPlan,
} from '../typeorm/entities/Subscription.entity';
import { Plan } from '../typeorm/entities/Plan.entity';

export interface EffectivePlan {
  plan: SubscriptionPlan;
  // The paid billing period in force; null on the free plan.
  billingPeriod: { start: Date; end: Date } | null;
}

const nextBillingPeriod = (start = new Date()) => {
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { currentPeriodStart: start, currentPeriodEnd: end };
};

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Plan)
    private planRepository: Repository<Plan>,
  ) {}

  async getOrCreateSubscription(userId: string): Promise<Subscription> {
    let subscription = await this.subscriptionRepository.findOne({
      where: { userId },
    });

    if (!subscription) {
      subscription = this.subscriptionRepository.create({
        userId,
        plan: SubscriptionPlan.FREE,
      });
      await this.subscriptionRepository.save(subscription);
    }

    return subscription;
  }

  // A paid plan applies until its period ends, even after cancelling; then the user is on free.
  async getEffectivePlan(userId: string): Promise<EffectivePlan> {
    const subscription = await this.getOrCreateSubscription(userId);
    const isPaidPeriodCurrent =
      subscription.plan !== SubscriptionPlan.FREE &&
      !!subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd > new Date();

    return isPaidPeriodCurrent
      ? {
          plan: subscription.plan,
          billingPeriod: {
            start: subscription.currentPeriodStart,
            end: subscription.currentPeriodEnd,
          },
        }
      : { plan: SubscriptionPlan.FREE, billingPeriod: null };
  }

  // Opens a paid billing period. What the plan grants is read from its row, never copied here.
  async activatePlan(
    userId: string,
    plan: SubscriptionPlan,
    paypalSubscriptionId?: string,
  ): Promise<Subscription> {
    const subscription = await this.getOrCreateSubscription(userId);
    Object.assign(subscription, {
      plan,
      isActive: true,
      ...nextBillingPeriod(),
      ...(paypalSubscriptionId && { paypalSubscriptionId }),
    });
    return this.subscriptionRepository.save(subscription);
  }

  // A renewal payment opens the next period, which also starts a new monthly credit window.
  async renewPeriod(
    paypalSubscriptionId: string,
  ): Promise<Subscription | null> {
    const subscription = await this.findByPayPalId(paypalSubscriptionId);
    if (!subscription) return null;
    Object.assign(subscription, { isActive: true, ...nextBillingPeriod() });
    return this.subscriptionRepository.save(subscription);
  }

  // Stops renewals; the plan stays in force until the paid period ends.
  async cancelRenewal(subscription: Subscription): Promise<void> {
    await this.subscriptionRepository.update(subscription.id, {
      isActive: false,
      paypalSubscriptionId: null,
    });
  }

  // A refunded or reversed payment ends the paid period right away.
  async endPaidPeriod(userId: string): Promise<void> {
    await this.subscriptionRepository.update(
      { userId },
      { isActive: false, currentPeriodEnd: new Date() },
    );
  }

  findByPayPalId(paypalSubscriptionId: string): Promise<Subscription | null> {
    return this.subscriptionRepository.findOne({
      where: { paypalSubscriptionId },
    });
  }

  findByUserId(userId: string): Promise<Subscription | null> {
    return this.subscriptionRepository.findOne({ where: { userId } });
  }

  async getAvailablePlans() {
    const plans = await this.planRepository.find({
      where: { isActive: true },
      order: { price: 'ASC' },
    });

    // Structured entitlements only: the frontend builds the translated plan copy from them.
    return plans.map(({ plan, price, isPopular, entitlements }) => ({
      plan,
      price: Number(price),
      isPopular,
      entitlements,
    }));
  }
}
