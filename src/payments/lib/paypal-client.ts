import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { SubscriptionPlan } from '../../typeorm/entities/Payment.entity';

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  mode: 'sandbox' | 'live';
  webhookId?: string;
}

export interface PayPalOrderResponse {
  id: string;
  status: string;
  links: Array<{ rel: string; href: string }>;
}

export interface PayPalCaptureResponse {
  id: string;
  status: string;
  purchase_units: Array<{
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount: {
          value: string;
          currency_code: string;
        };
      }>;
    };
  }>;
  payer?: {
    payer_id?: string;
    email_address?: string;
  };
}

@Injectable()
export class PayPalClient implements OnModuleInit {
  private readonly logger = new Logger(PayPalClient.name);
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  private readonly baseUrlSandbox = 'https://api-m.sandbox.paypal.com';
  private readonly baseUrlLive = 'https://api-m.paypal.com';

  constructor(private config: PayPalConfig) {}

  onModuleInit() {
    this.validateConfig();

    this.client = axios.create({
      baseURL: this.config.mode === 'sandbox' ? this.baseUrlSandbox : this.baseUrlLive,
    });

    this.logger.log(`PayPal initialized in ${this.config.mode} mode`);
  }

  private validateConfig() {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('PayPal clientId and clientSecret are required');
    }
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    const auth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString('base64');

    try {
      const response = await axios.post(
        `${this.config.mode === 'sandbox' ? this.baseUrlSandbox : this.baseUrlLive}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.accessToken = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiry = new Date(Date.now() + (expiresIn - 60) * 1000);

      return this.accessToken!;
    } catch (error) {
      this.logger.error('Failed to get PayPal access token', error);
      throw new Error('Failed to authenticate with PayPal');
    }
  }

  async createOrder(
    amount: number,
    currency: string = 'USD',
    customId?: string,
  ): Promise<PayPalOrderResponse> {
    const token = await this.getAccessToken();

    try {
      const response = await this.client.post(
        '/v2/checkout/orders',
        {
          intent: 'CAPTURE',
          purchase_units: [
            {
              amount: {
                currency_code: currency,
                value: amount.toFixed(2),
              },
              custom_id: customId,
            },
          ],
          application_context: {
            brand_name: 'estudiIA',
            landing_page: 'BILLING',
            user_action: 'PAY_NOW',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Created PayPal order: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create PayPal order', error);
      throw new Error('Failed to create PayPal order');
    }
  }

  async captureOrder(orderId: string): Promise<PayPalCaptureResponse> {
    const token = await this.getAccessToken();

    try {
      const response = await this.client.post(
        `/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Captured PayPal order: ${orderId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to capture PayPal order: ${orderId}`, error);
      throw new Error('Failed to capture PayPal order');
    }
  }

  async getOrderDetails(orderId: string): Promise<PayPalOrderResponse> {
    const token = await this.getAccessToken();

    try {
      const response = await this.client.get(
        `/v2/checkout/orders/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get PayPal order details: ${orderId}`, error);
      throw new Error('Failed to get PayPal order details');
    }
  }

  async refundCapture(
    captureId: string,
    amount?: number,
    currency?: string,
    note?: string,
  ): Promise<Record<string, unknown>> {
    const token = await this.getAccessToken();

    try {
      const payload: Record<string, unknown> = {};
      if (amount && currency) {
        payload.amount = {
          value: amount.toFixed(2),
          currency_code: currency,
        };
      }
      if (note) {
        payload.note_to_payer = note;
      }

      const response = await this.client.post(
        `/v2/payments/captures/${captureId}/refund`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Refunded capture: ${captureId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to refund capture: ${captureId}`, error);
      throw new Error('Failed to refund capture');
    }
  }

  async verifyWebhookSignature(
    headers: Record<string, string>,
    body: string,
  ): Promise<boolean> {
    if (!this.config.webhookId) {
      this.logger.error('No webhook ID configured, rejecting verification. Please set PAYPAL_WEBHOOK_ID.');
      return false;
    }

    try {
      const token = await this.getAccessToken();
      const webhookEvent = typeof body === 'string' ? JSON.parse(body) : body;

      const payload = {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: this.config.webhookId,
        webhook_event: webhookEvent,
      };

      const response = await this.client.post(
        '/v1/notifications/verify-webhook-signature',
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data?.verification_status === 'SUCCESS';
    } catch (error) {
      this.logger.error('Failed to verify PayPal webhook signature', error);
      return false;
    }
  }

  getPlanPrice(plan: SubscriptionPlan): number {
    const prices: Record<SubscriptionPlan, number> = {
      [SubscriptionPlan.FREE]: 0,
      [SubscriptionPlan.BASIC]: 9.99,
      [SubscriptionPlan.PRO]: 24.99,
      [SubscriptionPlan.ENTERPRISE]: 99,
    };
    return prices[plan];
  }
}
