import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Payment,
  PaymentStatus,
  SubscriptionPlan,
} from '../typeorm/entities/Payment.entity';
import { Subscription } from '../typeorm/entities/Subscription.entity';
import { PayPalClient } from './lib/paypal-client';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

export interface CreateOrderResponse {
  orderId: string;
  approvalUrl: string;
  paymentId: string;
}

export interface CreateSubscriptionResponse {
  subscriptionId: string;
  approvalUrl: string;
  paymentId: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    private payPalClient: PayPalClient,
    private subscriptionsService: SubscriptionsService,
  ) { }

  async createPayment(
    userId: string,
    plan: SubscriptionPlan,
  ): Promise<CreateOrderResponse> {
    const amount = this.payPalClient.getPlanPrice(plan);

    if (amount <= 0) {
      throw new BadRequestException('Invalid plan or plan is free');
    }

    const existingPending = await this.paymentRepository.findOne({
      where: {
        userId,
        plan,
        status: PaymentStatus.PENDING,
      },
    });

    if (existingPending) {
      const isExpired =
        existingPending.expiresAt && new Date() > existingPending.expiresAt;

      if (!isExpired && existingPending.paypalOrderId) {
        const approvalUrl = await this.getApprovalUrl(
          existingPending.paypalOrderId,
        );

        if (approvalUrl) {
          return {
            orderId: existingPending.paypalOrderId,
            approvalUrl,
            paymentId: existingPending.id,
          };
        }
      }

      await this.paymentRepository.update(existingPending.id, {
        status: PaymentStatus.CANCELLED,
      });
    }

    const paypalOrder = await this.payPalClient.createOrder(
      amount,
      'USD',
      userId,
    );

    const payment = this.paymentRepository.create({
      userId,
      plan,
      amount,
      currency: 'USD',
      paypalOrderId: paypalOrder.id,
      status: PaymentStatus.PENDING,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      metadata: {
        createdFrom: 'api',
      },
    });

    await this.paymentRepository.save(payment);

    const approvalUrl = this.findLink(paypalOrder.links, 'approve');
    if (!approvalUrl) {
      throw new InternalServerErrorException('Failed to get approval URL');
    }

    this.logger.log(
      `Created payment ${payment.id} for user ${userId}, plan ${plan}`,
    );

    return {
      orderId: paypalOrder.id,
      approvalUrl,
      paymentId: payment.id,
    };
  }

  async createSubscription(
    userId: string,
    plan: SubscriptionPlan,
  ): Promise<CreateSubscriptionResponse> {
    if (plan === SubscriptionPlan.FREE) {
      throw new BadRequestException('Free plan does not require subscription');
    }

    try {
      const paypalPlanId =
        await this.payPalClient.getPlanIdForSubscription(plan);
      const paypalSubscription = await this.payPalClient.createSubscription(
        paypalPlanId,
        userId,
      );

      const amount = this.payPalClient.getPlanPrice(plan);

      const payment = this.paymentRepository.create({
        userId,
        plan,
        amount,
        currency: 'USD',
        paypalSubscriptionId: paypalSubscription.id,
        status: PaymentStatus.PENDING,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        metadata: {
          createdFrom: 'subscription',
        },
      });

      await this.paymentRepository.save(payment);

      const approvalUrl = this.findLink(paypalSubscription.links, 'approve');
      if (!approvalUrl) {
        throw new InternalServerErrorException(
          'Failed to get subscription approval URL',
        );
      }

      this.logger.log(
        `Created subscription ${payment.id} for user ${userId}, plan ${plan}`,
      );

      return {
        subscriptionId: paypalSubscription.id,
        approvalUrl,
        paymentId: payment.id,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create subscription for user ${userId}`,
        error,
      );
      throw new InternalServerErrorException('Failed to create subscription');
    }
  }

  async activateUserSubscription(
    paymentId: string,
    userId: string,
  ): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, userId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (!payment.paypalSubscriptionId) {
      throw new BadRequestException(
        'No PayPal subscription associated with payment',
      );
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Subscription is not pending');
    }

    try {
      const subscriptionDetails =
        await this.payPalClient.getSubscriptionDetails(
          payment.paypalSubscriptionId,
        );

      if (subscriptionDetails.status === 'ACTIVE') {
        await this.paymentRepository.update(payment.id, {
          status: PaymentStatus.COMPLETED,
          completedAt: new Date(),
        });

        await this.activateSubscription(userId, payment.plan);

        this.logger.log(`Subscription ${payment.id} activated successfully`);

        return this.paymentRepository.findOneByOrFail({ id: payment.id });
      } else if (subscriptionDetails.status === 'APPROVAL_PENDING') {
        throw new BadRequestException(
          'Please complete PayPal subscription approval',
        );
      } else {
        throw new BadRequestException(
          `Subscription status: ${subscriptionDetails.status}`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to activate subscription: ${paymentId}`, error);
      throw new InternalServerErrorException('Failed to activate subscription');
    }
  }

  async capturePayment(paymentId: string, userId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, userId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment is not pending');
    }

    if (!payment.paypalOrderId) {
      throw new BadRequestException('No PayPal order associated with payment');
    }

    if (payment.expiresAt && new Date() > payment.expiresAt) {
      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.CANCELLED,
      });
      throw new BadRequestException('Payment has expired');
    }

    try {
      const capture = await this.payPalClient.captureOrder(
        payment.paypalOrderId,
      );

      if (capture.status === 'COMPLETED') {
        const captureData = capture.purchase_units[0]?.payments?.captures?.[0];

        await this.paymentRepository.update(payment.id, {
          status: PaymentStatus.COMPLETED,
          paypalCaptureId: captureData?.id || capture.id,
          paypalPayerId: capture.payer?.payer_id,
          paypalPayerEmail: capture.payer?.email_address,
          completedAt: new Date(),
        });

        await this.activateSubscription(userId, payment.plan);

        this.logger.log(`Payment ${payment.id} completed successfully`);

        return this.paymentRepository.findOneByOrFail({ id: payment.id });
      } else {
        await this.paymentRepository.update(payment.id, {
          status: PaymentStatus.FAILED,
          failureReason: `PayPal capture status: ${capture.status}`,
        });

        throw new BadRequestException('Payment capture failed');
      }
    } catch (error) {
      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.FAILED,
        failureReason: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async handleWebhook(event: Record<string, unknown>): Promise<void> {
    const eventId = event.id as string;
    const eventType = event.event_type as string;
    const resource = event.resource as Record<string, unknown>;

    const existingEvent = await this.paymentRepository.findOne({
      where: { eventId },
    });

    if (existingEvent) {
      this.logger.log(`Duplicate webhook event ${eventId}, skipping`);
      return;
    }

    this.logger.log(`Processing webhook event: ${eventType} (${eventId})`);

    switch (eventType) {
      case 'CHECKOUT.ORDER.APPROVED':
        await this.handleOrderApproved(resource);
        break;
      case 'PAYMENT.CAPTURE.COMPLETED':
        await this.handlePaymentCompleted(resource);
        break;
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await this.handleSubscriptionActivated(resource);
        break;
      case 'PAYMENT.SALE.COMPLETED':
        await this.handleRecurringPaymentCompleted(resource);
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await this.handleSubscriptionCancelled(resource);
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        await this.handlePaymentDenied(resource);
        break;
      case 'PAYMENT.CAPTURE.REFUNDED':
        await this.handlePaymentRefunded(resource);
        break;
      case 'PAYMENT.CAPTURE.REVERSED':
        await this.handlePaymentReversed(resource);
        break;
      default:
        this.logger.warn(`Unhandled event type: ${eventType}`);
    }
  }

  private async handleOrderApproved(
    resource: Record<string, unknown>,
  ): Promise<void> {
    const orderId = resource.id as string;

    const payment = await this.paymentRepository.findOne({
      where: { paypalOrderId: orderId },
    });

    if (payment && payment.status === PaymentStatus.PENDING) {
      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.APPROVED,
      });
      this.logger.log(`Payment ${payment.id} approved for order ${orderId}`);
    }
  }

  private async handlePaymentCompleted(
    resource: Record<string, unknown>,
  ): Promise<void> {
    const captureId = resource.id as string;
    const supplementalInfo = resource.supplemental_data as Record<
      string,
      unknown
    >;
    const orderId = supplementalInfo?.order_id as string;

    if (!orderId) {
      this.logger.error('No order ID in payment completed webhook');
      return;
    }

    const payment = await this.paymentRepository.findOne({
      where: { paypalOrderId: orderId },
    });

    if (!payment) {
      this.logger.error(`Payment not found for order ${orderId}`);
      return;
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      this.logger.log(`Payment ${payment.id} already completed, skipping`);
      return;
    }

    const userId = payment.userId;

    await this.paymentRepository.update(payment.id, {
      status: PaymentStatus.COMPLETED,
      paypalCaptureId: captureId,
      completedAt: new Date(),
      eventId: resource.id as string,
    });

    await this.activateSubscription(userId, payment.plan);

    this.logger.log(`Payment ${payment.id} completed via webhook`);
  }

  private async handlePaymentDenied(
    resource: Record<string, unknown>,
  ): Promise<void> {
    const supplementalInfo = resource.supplemental_data as Record<
      string,
      unknown
    >;
    const orderId = supplementalInfo?.order_id as string;

    if (!orderId) return;

    const payment = await this.paymentRepository.findOne({
      where: { paypalOrderId: orderId },
    });

    if (payment) {
      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.FAILED,
        failureReason: 'Payment denied by PayPal',
        eventId: resource.id as string,
      });
      this.logger.log(`Payment ${payment.id} denied`);
    }
  }

  private async handlePaymentRefunded(
    resource: Record<string, unknown>,
  ): Promise<void> {
    const refundId = resource.id as string;
    const supplementalInfo = resource.supplemental_data as Record<
      string,
      unknown
    >;
    const captureId = supplementalInfo?.captures as string;

    if (!captureId) return;

    const payment = await this.paymentRepository.findOne({
      where: { paypalCaptureId: captureId },
    });

    if (payment) {
      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.REFUNDED,
        eventId: refundId,
      });
      this.logger.log(`Payment ${payment.id} refunded`);
    }
  }

  private async handlePaymentReversed(
    resource: Record<string, unknown>,
  ): Promise<void> {
    const supplementalInfo = resource.supplemental_data as Record<
      string,
      unknown
    >;
    const captureId = supplementalInfo?.captures as string;

    if (!captureId) return;

    const payment = await this.paymentRepository.findOne({
      where: { paypalCaptureId: captureId },
    });

    if (payment) {
      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.REFUNDED,
        failureReason: 'Payment reversed/charged back',
        eventId: resource.id as string,
      });
      this.logger.log(`Payment ${payment.id} reversed`);
    }
  }

  private async handleSubscriptionActivated(
    resource: Record<string, unknown>,
  ): Promise<void> {
    const subscriptionId = resource.id as string;
    const planId = resource.plan_id as string;
    const customId = resource.custom_id as string; // User ID passed during creation

    if (!customId) {
      this.logger.error(
        `No custom_id (userId) found in subscription ${subscriptionId}`,
      );
      return;
    }

    // Map PayPal Plan ID to our local plan (you should define this mapping)
    // For now, we'll try to find a payment or just update the user's subscription
    const plan = this.mapPayPalPlanToLocal(planId);

    await this.subscriptionRepository.update(
      { userId: customId },
      {
        paypalSubscriptionId: subscriptionId,
        isActive: true,
      },
    );

    await this.activateSubscription(customId, plan);
    this.logger.log(
      `Subscription ${subscriptionId} activated for user ${customId}`,
    );
  }

  private async handleRecurringPaymentCompleted(
    resource: Record<string, unknown>,
  ): Promise<void> {
    const subscriptionId = resource.billing_agreement_id as string;
    const amountObj = resource.amount as any;
    const amount = parseFloat(amountObj?.value || '0');
    const currency = amountObj?.currency_code || 'USD';
    const transactionId = resource.id as string;

    const subscription = await this.subscriptionRepository.findOne({
      where: { paypalSubscriptionId: subscriptionId },
    });

    if (!subscription) {
      this.logger.error(`Subscription not found for ID: ${subscriptionId}`);
      return;
    }

    const payment = this.paymentRepository.create({
      userId: subscription.userId,
      plan: subscription.plan,
      amount,
      currency,
      paypalSubscriptionId: subscriptionId,
      paypalCaptureId: transactionId,
      status: PaymentStatus.COMPLETED,
      completedAt: new Date(),
    });

    await this.paymentRepository.save(payment);

    // Extend the period (assuming 30 days)
    const nextEnd = new Date();
    nextEnd.setDate(nextEnd.getDate() + 30);

    await this.subscriptionRepository.update(subscription.id, {
      isActive: true,
      currentPeriodEnd: nextEnd,
    });

    this.logger.log(
      `Recurring payment ${transactionId} processed for user ${subscription.userId}`,
    );
  }

  private async handleSubscriptionCancelled(
    resource: Record<string, unknown>,
  ): Promise<void> {
    const subscriptionId = resource.id as string;

    const subscription = await this.subscriptionRepository.findOne({
      where: { paypalSubscriptionId: subscriptionId },
    });

    if (subscription) {
      await this.subscriptionRepository.update(subscription.id, {
        isActive: false,
        paypalSubscriptionId: null as any,
      });

      // Optionally Downgrade to FREE immediately or wait until period end
      // For now, just mark inactive
      this.logger.log(`Subscription ${subscriptionId} cancelled`);
    }
  }

  async cancelUserSubscription(userId: string): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId },
    });

    if (!subscription || !subscription.paypalSubscriptionId) {
      throw new BadRequestException('No active PayPal subscription found');
    }

    await this.payPalClient.cancelSubscription(
      subscription.paypalSubscriptionId,
      'User requested cancellation via app',
    );

    // Update local DB
    await this.subscriptionRepository.update(subscription.id, {
      isActive: false,
      paypalSubscriptionId: null as any,
    });
  }

  private mapPayPalPlanToLocal(paypalPlanId: string): SubscriptionPlan {
    // This should be configurable via env variables
    const planMapping: Record<string, SubscriptionPlan> = {
      [process.env.PAYPAL_PLAN_BASIC_ID || '']: SubscriptionPlan.BASIC,
      [process.env.PAYPAL_PLAN_PRO_ID || '']: SubscriptionPlan.PRO,
      [process.env.PAYPAL_PLAN_ENTERPRISE_ID || '']:
        SubscriptionPlan.ENTERPRISE,
    };

    return planMapping[paypalPlanId] || SubscriptionPlan.BASIC;
  }

  async getPaymentById(paymentId: string, userId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, userId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async getUserPayments(userId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  private async activateSubscription(
    userId: string,
    plan: SubscriptionPlan,
  ): Promise<void> {
    const limits = await this.subscriptionsService.getPlanLimits(plan);

    await this.subscriptionsService.updatePlan(userId, plan, limits);

    this.logger.log(`Subscription activated for user ${userId}, plan ${plan}`);
  }

  private async getApprovalUrl(orderId: string): Promise<string | null> {
    try {
      const details = await this.payPalClient.getOrderDetails(orderId);
      return this.findLink(details.links, 'approve');
    } catch {
      return null;
    }
  }

  private findLink(
    links: Array<{ rel: string; href: string }>,
    rel: string,
  ): string | null {
    const link = links.find((l) => l.rel === rel);
    return link?.href || null;
  }
}
