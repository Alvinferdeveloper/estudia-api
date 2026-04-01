import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';
import { SubscriptionPlan } from '../typeorm/entities/Payment.entity';
import { PayPalClient } from './lib/paypal-client';
import type { Request } from 'express';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly payPalClient: PayPalClient,
  ) {}

  @Post('create-order')
  @UseGuards(AuthGuard)
  async createOrder(
    @CurrentUserId() userId: string,
    @Body() body: { plan: SubscriptionPlan },
  ) {
    return this.paymentsService.createPayment(userId, body.plan);
  }

  @Post('capture/:paymentId')
  @UseGuards(AuthGuard)
  async capturePayment(
    @Param('paymentId') paymentId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.paymentsService.capturePayment(paymentId, userId);
  }

  @Get()
  @UseGuards(AuthGuard)
  async getPayments(@CurrentUserId() userId: string) {
    return this.paymentsService.getUserPayments(userId);
  }

  @Get(':paymentId')
  @UseGuards(AuthGuard)
  async getPayment(
    @Param('paymentId') paymentId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.paymentsService.getPaymentById(paymentId, userId);
  }

  @Post('webhook')
  async handleWebhook(
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody?.toString() || JSON.stringify(req.body);

    const isValid = await this.payPalClient.verifyWebhookSignature(
      headers,
      rawBody,
    );

    if (!isValid) {
      return { status: 'error', message: 'Invalid webhook signature' };
    }

    await this.paymentsService.handleWebhook(req.body);

    return { status: 'success' };
  }
}
