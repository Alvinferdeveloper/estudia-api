import { Controller, Get, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';

// Read-only: plans change only through verified payments (PaymentsService).
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
    const subscription =
      await this.subscriptionsService.getOrCreateSubscription(userId);
    return { plans, currentPlan: subscription.plan };
  }

  @Get('usage')
  async getUsage(@CurrentUserId() userId: string) {
    return this.subscriptionsService.getUsageStats(userId);
  }
}
