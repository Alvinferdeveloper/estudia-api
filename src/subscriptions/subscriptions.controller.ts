import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';
import { SubscriptionPlan } from '../typeorm/entities/Subscription.entity';

@Controller('subscriptions')
@UseGuards(AuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  async getSubscription(@CurrentUserId() userId: string) {
    return this.subscriptionsService.getOrCreateSubscription(userId);
  }

  @Get('plans')
  async getPlans(@CurrentUserId() userId: string) {
    const plans = await this.subscriptionsService.getAvailablePlans();
    const subscription = await this.subscriptionsService.getOrCreateSubscription(userId);
    return { plans, currentPlan: subscription.plan };
  }

  @Get('usage')
  async getUsage(@CurrentUserId() userId: string) {
    return this.subscriptionsService.getUsageStats(userId);
  }

  @Get('can-chat')
  async canChat(@CurrentUserId() userId: string) {
    const canUse = await this.subscriptionsService.canUseChat(userId);
    return { canUse };
  }

  @Get('can-ai-note')
  async canAiNote(@CurrentUserId() userId: string) {
    const canUse = await this.subscriptionsService.canUseAiNote(userId);
    return { canUse };
  }

  @Post('increment-chat')
  async incrementChat(@CurrentUserId() userId: string) {
    await this.subscriptionsService.incrementChatUsage(userId);
    return { success: true };
  }

  @Post('increment-ai-note')
  async incrementAiNote(@CurrentUserId() userId: string) {
    await this.subscriptionsService.incrementAiNoteUsage(userId);
    return { success: true };
  }

  @Post('update-plan')
  async updatePlan(
    @CurrentUserId() userId: string,
    @Body() body: { plan: SubscriptionPlan },
  ) {
    return this.subscriptionsService.updatePlan(userId, body.plan);
  }

  @Post('reset-usage')
  async resetUsage(@CurrentUserId() userId: string) {
    await this.subscriptionsService.resetUsage(userId);
    return { success: true };
  }
}
