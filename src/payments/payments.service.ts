import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, SubscriptionPlan } from '../typeorm/entities/Payment.entity';
import { PayPalClient } from './lib/paypal-client';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

export interface CreateOrderResponse {
  orderId: string;
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
        existingPending.expiresAt &&
        new Date() > existingPending.expiresAt;

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

    this.logger.log(`Created payment ${payment.id} for user ${userId}, plan ${plan}`);

    return {
      orderId: paypalOrder.id,
      approvalUrl,
      paymentId: payment.id,
    };
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

  private async handleOrderApproved(resource: Record<string, unknown>): Promise<void> {
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

  private async handlePaymentCompleted(resource: Record<string, unknown>): Promise<void> {
    const captureId = resource.id as string;
    const supplementalInfo = resource.supplemental_data as Record<string, unknown>;
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

  private async handlePaymentDenied(resource: Record<string, unknown>): Promise<void> {
    const supplementalInfo = resource.supplemental_data as Record<string, unknown>;
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

  private async handlePaymentRefunded(resource: Record<string, unknown>): Promise<void> {
    const refundId = resource.id as string;
    const supplementalInfo = resource.supplemental_data as Record<string, unknown>;
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

  private async handlePaymentReversed(resource: Record<string, unknown>): Promise<void> {
    const supplementalInfo = resource.supplemental_data as Record<string, unknown>;
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
