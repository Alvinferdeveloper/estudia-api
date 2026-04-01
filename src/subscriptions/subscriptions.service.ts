import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionPlan } from '../typeorm/entities/Subscription.entity';
import { Plan } from '../typeorm/entities/Plan.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Plan)
    private planRepository: Repository<Plan>,
  ) { }

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
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async canUseChat(userId: string): Promise<boolean> {
    const subscription = await this.getOrCreateSubscription(userId);
    return subscription.chatMessagesUsed < subscription.chatMessagesLimit;
  }

  async canUseAiNote(userId: string): Promise<boolean> {
    const subscription = await this.getOrCreateSubscription(userId);
    return subscription.aiNotesUsed < subscription.aiNotesLimit;
  }

  async incrementChatUsage(userId: string): Promise<void> {
    await this.subscriptionRepository.increment(
      { userId },
      'chatMessagesUsed',
      1,
    );
  }

  async incrementAiNoteUsage(userId: string): Promise<void> {
    await this.subscriptionRepository.increment(
      { userId },
      'aiNotesUsed',
      1,
    );
  }

  async updatePlan(userId: string, plan: SubscriptionPlan, limits?: {
    chatMessagesLimit: number;
    aiNotesLimit: number;
    documentsLimit: number;
    storageLimitBytes: number;
    hasSemanticSearch: boolean;
    hasVectorization: boolean;
    hasAdvancedModels: boolean;
    hasExportNotes: boolean;
    hasApiAccess: boolean;
  }): Promise<Subscription> {
    const planLimits = limits || await this.getPlanLimits(plan);
    const subscription = await this.getOrCreateSubscription(userId);

    subscription.plan = plan;
    subscription.isActive = true;
    subscription.currentPeriodStart = new Date();
    subscription.currentPeriodEnd = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    );
    subscription.chatMessagesLimit = planLimits.chatMessagesLimit;
    subscription.aiNotesLimit = planLimits.aiNotesLimit;
    subscription.documentsLimit = planLimits.documentsLimit;
    subscription.storageLimitBytes = planLimits.storageLimitBytes;
    subscription.hasSemanticSearch = planLimits.hasSemanticSearch;
    subscription.hasVectorization = planLimits.hasVectorization;
    subscription.hasAdvancedModels = planLimits.hasAdvancedModels;
    subscription.hasExportNotes = planLimits.hasExportNotes;
    subscription.hasApiAccess = planLimits.hasApiAccess;

    return this.subscriptionRepository.save(subscription);
  }

  async getUsageStats(userId: string) {
    const subscription = await this.getOrCreateSubscription(userId);

    return {
      plan: subscription.plan,
      isActive: subscription.isActive,
      chat: {
        used: subscription.chatMessagesUsed,
        limit: subscription.chatMessagesLimit,
        remaining: Math.max(0, subscription.chatMessagesLimit - subscription.chatMessagesUsed),
      },
      aiNotes: {
        used: subscription.aiNotesUsed,
        limit: subscription.aiNotesLimit,
        remaining: Math.max(0, subscription.aiNotesLimit - subscription.aiNotesUsed),
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

  async resetUsage(userId: string): Promise<void> {
    await this.subscriptionRepository.update(
      { userId },
      {
        chatMessagesUsed: 0,
        aiNotesUsed: 0,
      },
    );
  }

  async getAvailablePlans() {
    const plans = await this.planRepository.find({
      where: { isActive: true },
      order: { price: 'ASC' },
    });

    return plans.map((plan) => ({
      plan: plan.plan,
      name: plan.name,
      price: Number(plan.price),
      description: plan.description,
      features: plan.features || [],
      isPopular: plan.isPopular,
    }));
  }

  async getPlanLimits(plan: SubscriptionPlan) {
    const planData = await this.planRepository.findOne({
      where: { plan, isActive: true },
    });

    if (!planData) {
      throw new NotFoundException(`Plan ${plan} not found`);
    }

    return {
      chatMessagesLimit: planData.chatMessagesLimit,
      aiNotesLimit: planData.aiNotesLimit,
      documentsLimit: planData.documentsLimit,
      storageLimitBytes: Number(planData.storageLimitBytes),
      hasSemanticSearch: planData.hasSemanticSearch,
      hasVectorization: planData.hasVectorization,
      hasAdvancedModels: planData.hasAdvancedModels,
      hasExportNotes: planData.hasExportNotes,
      hasApiAccess: planData.hasApiAccess,
    };
  }
}