import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from '../typeorm/entities/Plan.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { EntitlementsService } from './entitlements.service';
import { FeatureGuard } from './require-feature.decorator';

@Module({
  imports: [TypeOrmModule.forFeature([Plan]), SubscriptionsModule],
  providers: [EntitlementsService, FeatureGuard],
  exports: [EntitlementsService, FeatureGuard],
})
export class EntitlementsModule {}
