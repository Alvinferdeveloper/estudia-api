import { Controller, Get, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';

// Read-only: plans change only through verified payments (PaymentsService); usage lives at /usage.
@Controller('subscriptions')
@UseGuards(AuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  async getPlans(@CurrentUserId() userId: string) {
    const [plans, { plan }] = await Promise.all([
      this.subscriptionsService.getAvailablePlans(),
      this.subscriptionsService.getEffectivePlan(userId),
    ]);
    return { plans, currentPlan: plan };
  }
}
