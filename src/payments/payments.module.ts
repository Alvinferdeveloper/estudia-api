import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../typeorm/entities/Payment.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PayPalClient } from './lib/paypal-client';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    SubscriptionsModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PayPalClient,
      useFactory: () => {
        return new PayPalClient({
          clientId: process.env.PAYPAL_CLIENT_ID || '',
          clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
          mode: (process.env.PAYPAL_MODE as 'sandbox' | 'live') || 'sandbox',
          webhookId: process.env.PAYPAL_WEBHOOK_ID,
        });
      },
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
