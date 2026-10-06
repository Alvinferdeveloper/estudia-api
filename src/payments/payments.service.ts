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
import { PayPalClient } from './lib/paypal-client';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ErrorCode } from '../common/errors/error-codes';

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
    private payPalClient: PayPalClient,
    private subscriptionsService: SubscriptionsService,
  ) {}

  async createPayment(
    userId: string,
    plan: SubscriptionPlan,
  ): Promise<CreateOrderResponse> {
    const amount = this.payPalClient.getPlanPrice(plan);

    if (amount <= 0) {
      throw new BadRequestException({ code: ErrorCode.INVALID_PLAN });
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
      throw new InternalServerErrorException({
        code: ErrorCode.PAYMENT_CREATION_FAILED,
      });
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
      throw new BadRequestException({ code: ErrorCode.INVALID_PLAN });
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
        throw new InternalServerErrorException({
          code: ErrorCode.PAYMENT_CREATION_FAILED,
        });
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
      throw new InternalServerErrorException({
        code: ErrorCode.PAYMENT_CREATION_FAILED,
      });
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
      throw new NotFoundException({ code: ErrorCode.PAYMENT_NOT_FOUND });
    }

    if (!payment.paypalSubscriptionId) {
      throw new BadRequestException({
        code: ErrorCode.PAYMENT_INVALID_STATE,
        message: 'No PayPal subscription associated with payment',
      });
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException({
        code: ErrorCode.PAYMENT_INVALID_STATE,
        message: 'Subscription is not pending',
      });
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
        throw new BadRequestException({
          code: ErrorCode.PAYMENT_APPROVAL_PENDING,
        });
      } else {
        throw new BadRequestException({
          code: ErrorCode.PAYMENT_INVALID_STATE,
          message: `Subscription status: ${subscriptionDetails.status}`,
        });
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to activate subscription: ${paymentId}`, error);
      throw new InternalServerErrorException({
        code: ErrorCode.SUBSCRIPTION_ACTIVATION_FAILED,
      });
    }
  }

  async capturePayment(paymentId: string, userId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, userId },
    });

    if (!payment) {
      throw new NotFoundException({ code: ErrorCode.PAYMENT_NOT_FOUND });
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException({
        code: ErrorCode.PAYMENT_INVALID_STATE,
        message: 'Payment is not pending',
      });
    }

    if (!payment.paypalOrderId) {
      throw new BadRequestException({
        code: ErrorCode.PAYMENT_INVALID_STATE,
        message: 'No PayPal order associated with payment',
      });
    }

    if (payment.expiresAt && new Date() > payment.expiresAt) {
      await this.paymentRepository.update(payment.id, {
        status: PaymentStatus.CANCELLED,
      });
      throw new BadRequestException({ code: ErrorCode.PAYMENT_EXPIRED });
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

        throw new BadRequestException({
          code: ErrorCode.PAYMENT_CAPTURE_FAILED,
        });
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
      await this.subscriptionsService.endPaidPeriod(payment.userId);
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
      await this.subscriptionsService.endPaidPeriod(payment.userId);
      this.logger.log(`Payment ${payment.id} reversed`);
    }
  }

  private async handleSubscriptionActivated(
    resource: Record<string, unknown>,
  ): Promise<void> {
    const subscriptionId = resource.id as string;
    const userId = resource.custom_id as string; // Set when the subscription was created
    if (!userId) {
      this.logger.error(
        `No custom_id (userId) in subscription ${subscriptionId}`,
      );
      return;
    }

    const plan = this.mapPayPalPlanToLocal(resource.plan_id as string);
    if (!plan) {
      this.logger.error(
        `Unknown PayPal plan ${String(resource.plan_id)} for subscription ${subscriptionId}`,
      );
      return;
    }

    await this.subscriptionsService.activatePlan(userId, plan, subscriptionId);
    this.logger.log(
      `Subscription ${subscriptionId} activated for user ${userId}`,
    );
  }

  private async handleRecurringPaymentCompleted(
    resource: Record<string, unknown>,
  ): Promise<void> {
    const subscriptionId = resource.billing_agreement_id as string;
    const amountObj = resource.amount as any;
    const transactionId = resource.id as string;

    const subscription = await this.subscriptionsService.renewPeriod(
      subscriptionId,
    );
    if (!subscription) {
      this.logger.error(`Subscription not found for ID: ${subscriptionId}`);
      return;
    }

    await this.paymentRepository.save(
      this.paymentRepository.create({
        userId: subscription.userId,
        plan: subscription.plan,
        amount: parseFloat(amountObj?.value || '0'),
        currency: amountObj?.currency_code || 'USD',
        paypalSubscriptionId: subscriptionId,
        paypalCaptureId: transactionId,
        status: PaymentStatus.COMPLETED,
        completedAt: new Date(),
      }),
    );

    this.logger.log(
      `Recurring payment ${transactionId} processed for user ${subscription.userId}`,
    );
  }

  private async handleSubscriptionCancelled(
    resource: Record<string, unknown>,
  ): Promise<void> {
    const subscriptionId = resource.id as string;
    const subscription =
      await this.subscriptionsService.findByPayPalId(subscriptionId);

    if (subscription) {
      await this.subscriptionsService.cancelRenewal(subscription);
      this.logger.log(`Subscription ${subscriptionId} cancelled`);
    }
  }

  async cancelUserSubscription(userId: string): Promise<void> {
    const subscription = await this.subscriptionsService.findByUserId(userId);

    if (!subscription?.paypalSubscriptionId) {
      throw new BadRequestException({ code: ErrorCode.NO_ACTIVE_SUBSCRIPTION });
    }

    await this.payPalClient.cancelSubscription(
      subscription.paypalSubscriptionId,
      'User requested cancellation via app',
    );
    await this.subscriptionsService.cancelRenewal(subscription);
  }

  // Null for an id that isn't configured, so a misconfigured plan never grants a paid one by default.
  private mapPayPalPlanToLocal(paypalPlanId: string): SubscriptionPlan | null {
    const planMapping: Record<string, SubscriptionPlan> = {
      [process.env.PAYPAL_PLAN_BASIC_ID || '']: SubscriptionPlan.BASIC,
      [process.env.PAYPAL_PLAN_PRO_ID || '']: SubscriptionPlan.PRO,
      [process.env.PAYPAL_PLAN_ENTERPRISE_ID || '']:
        SubscriptionPlan.ENTERPRISE,
    };

    return (paypalPlanId && planMapping[paypalPlanId]) || null;
  }

  async getPaymentById(paymentId: string, userId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, userId },
    });

    if (!payment) {
      throw new NotFoundException({ code: ErrorCode.PAYMENT_NOT_FOUND });
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
    await this.subscriptionsService.activatePlan(userId, plan);
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
