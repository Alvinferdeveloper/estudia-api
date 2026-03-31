import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from '../typeorm/entities/Subscription.entity';
import { Plan } from '../typeorm/entities/Plan.entity';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PlansSeed } from './plans.seed';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, Plan])],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, PlansSeed],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
