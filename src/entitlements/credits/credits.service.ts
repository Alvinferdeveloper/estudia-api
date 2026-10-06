import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CreditUsage } from '../../typeorm/entities/CreditUsage.entity';
import { CreditLedgerEntry } from '../../typeorm/entities/CreditLedgerEntry.entity';
import { ErrorCode } from '../../common/errors/error-codes';
import { aiCallContext } from '../../ai/metering/ai-call-context';
import type { StreamTextResult } from '../../ai/providers/ai-provider.interface';
import { EntitlementsService } from '../entitlements.service';
import { creditCost, UNLIMITED, type CreditRequest } from '../catalog';
import { currentCreditWindow, type CreditWindow } from './credit-period';

export interface CreditBalance {
  used: number;
  // UNLIMITED (-1) when the plan has no credit limit.
  limit: number;
  resetsAt: Date;
}

// A reserved charge: run the paid work inside it; refund is idempotent.
export interface CreditCharge {
  run<T>(work: () => Promise<T>): Promise<T>;
  refund(): Promise<void>;
}

@Injectable()
export class CreditsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  // Charges before the work runs and refunds if it throws.
  async charge<T>(
    userId: string,
    request: CreditRequest,
    work: () => Promise<T>,
  ): Promise<T> {
    const charge = await this.reserve(userId, request);
    return charge.run(work);
  }

  // Streams can fail after they start; their usage settles null then, which refunds the charge.
  async chargeStream(
    userId: string,
    request: CreditRequest,
    work: () => Promise<StreamTextResult>,
  ): Promise<ReadableStream> {
    const charge = await this.reserve(userId, request);
    const { stream, usage } = await charge.run(work);
    void usage.then((settled) => (settled ? undefined : charge.refund()));
    return stream;
  }

  async getBalance(userId: string): Promise<CreditBalance> {
    const { limit, window } = await this.resolveWindow(userId);
    const row = await this.dataSource
      .getRepository(CreditUsage)
      .findOne({ where: { userId, periodKey: window.key } });
    return { used: row?.used ?? 0, limit, resetsAt: window.resetsAt };
  }

  async reserve(userId: string, request: CreditRequest): Promise<CreditCharge> {
    const cost = creditCost(request);
    const { limit, window } = await this.resolveWindow(userId);

    const entry = await this.dataSource.transaction(async (manager) => {
      const reserved = await this.consume(manager, userId, window, cost, limit);
      if (!reserved) return null;
      return this.appendLedger(manager, {
        userId,
        action: request.action,
        credits: -cost,
        periodKey: window.key,
        metadata: 'params' in request ? request.params : null,
      });
    });

    if (!entry) {
      throw new ForbiddenException({
        code: ErrorCode.INSUFFICIENT_CREDITS,
        params: { required: cost, resetsAt: window.resetsAt.toISOString() },
      });
    }

    let refunded = false;
    const refund = async () => {
      if (refunded) return;
      refunded = true;
      await this.refundEntry(entry, cost);
    };

    return {
      refund,
      run: async (work) => {
        try {
          // AI calls made by `work` are logged against this entry.
          return await aiCallContext.run(
            { userId, ledgerEntryId: entry.id },
            work,
          );
        } catch (error) {
          await refund();
          throw error;
        }
      },
    };
  }

  private async resolveWindow(
    userId: string,
  ): Promise<{ limit: number; window: CreditWindow }> {
    const { entitlements, billingPeriod } =
      await this.entitlementsService.getEffective(userId);
    return {
      limit: entitlements.credits.amount,
      window: currentCreditWindow(entitlements.credits.period, billingPeriod),
    };
  }

  // One conditional UPDATE, so concurrent requests can't overspend the last credits.
  private async consume(
    manager: EntityManager,
    userId: string,
    window: CreditWindow,
    cost: number,
    limit: number,
  ): Promise<boolean> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(CreditUsage)
      .values({ userId, periodKey: window.key, used: 0 })
      .orIgnore()
      .execute();

    const update = manager
      .createQueryBuilder()
      .update(CreditUsage)
      .set({ used: () => 'used + :cost' })
      .where('userId = :userId AND periodKey = :periodKey', {
        userId,
        periodKey: window.key,
        cost,
      });
    if (limit !== UNLIMITED) {
      update.andWhere('used + :cost <= :limit', { limit });
    }

    const result = await update.execute();
    return (result.affected ?? 0) > 0;
  }

  private async refundEntry(entry: CreditLedgerEntry, cost: number) {
    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(CreditUsage)
        .set({ used: () => 'GREATEST(used - :cost, 0)' })
        .where('userId = :userId AND periodKey = :periodKey', {
          userId: entry.userId,
          periodKey: entry.periodKey,
          cost,
        })
        .execute();
      await this.appendLedger(manager, {
        userId: entry.userId,
        action: entry.action,
        credits: cost,
        periodKey: entry.periodKey,
        metadata: { refundOf: entry.id },
      });
    });
  }

  private appendLedger(
    manager: EntityManager,
    entry: Omit<CreditLedgerEntry, 'id' | 'createdAt'>,
  ): Promise<CreditLedgerEntry> {
    return manager.save(manager.create(CreditLedgerEntry, entry));
  }
}
