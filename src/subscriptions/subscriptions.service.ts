import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Subscription,
  SubscriptionPlan,
} from '../typeorm/entities/Subscription.entity';
import { Plan } from '../typeorm/entities/Plan.entity';
import { ErrorCode } from '../common/errors/error-codes';

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
        isActive: true,
        chatMessagesUsed: 0,
        chatMessagesLimit: 30,
        aiNotesUsed: 0,
        aiNotesLimit: 20,
        documentsLimit: 3,
        storageLimitBytes: 52428800,
        hasSemanticSearch: false,
        hasVectorization: false,
        hasAdvancedModels: false,
        hasExportNotes: false,
        hasApiAccess: false,
      });
      await this.subscriptionRepository.save(subscription);
    }

    return subscription;
  }

  async getSubscription(userId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException({ code: ErrorCode.SUBSCRIPTION_NOT_FOUND });
    }

    return subscription;
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

  async getUsageStats(userId: string) {
    const subscription = await this.getOrCreateSubscription(userId);

    return {
      plan: subscription.plan,
      isActive: subscription.isActive,
      chat: {
        used: subscription.chatMessagesUsed,
        limit: subscription.chatMessagesLimit,
        remaining: Math.max(
          0,
          subscription.chatMessagesLimit - subscription.chatMessagesUsed,
        ),
      },
      aiNotes: {
        used: subscription.aiNotesUsed,
        limit: subscription.aiNotesLimit,
        remaining: Math.max(
          0,
          subscription.aiNotesLimit - subscription.aiNotesUsed,
        ),
      },
      documents: {
        limit: subscription.documentsLimit,
      },
      storage: {
        limit: subscription.storageLimitBytes,
      },
      features: {
        semanticSearch: subscription.hasSemanticSearch,
        vectorization: subscription.hasVectorization,
        advancedModels: subscription.hasAdvancedModels,
        exportNotes: subscription.hasExportNotes,
        apiAccess: subscription.hasApiAccess,
      },
    };
  }

  async getAvailablePlans() {
    const plans = await this.planRepository.find({
      where: { isActive: true },
      order: { price: 'ASC' },
    });

    // Only structured limits: the frontend builds the translated plan copy from them.
    return plans.map((plan) => ({
      plan: plan.plan,
      price: Number(plan.price),
      isPopular: plan.isPopular,
      limits: {
        chatMessages: plan.chatMessagesLimit,
        aiNotes: plan.aiNotesLimit,
        documents: plan.documentsLimit,
        storageBytes: Number(plan.storageLimitBytes),
      },
      features: {
        semanticSearch: plan.hasSemanticSearch,
        vectorization: plan.hasVectorization,
        advancedModels: plan.hasAdvancedModels,
        exportNotes: plan.hasExportNotes,
        apiAccess: plan.hasApiAccess,
      },
    }));
  }
}
