import type { CreditPeriod } from '../catalog';
import { startOfUtcDay } from '../../common/utils/utc-day.util';

export interface CreditWindow {
  key: string;
  resetsAt: Date;
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

// Daily windows follow the UTC day. Monthly windows follow the paid billing period when there
// is one, otherwise the UTC calendar month.
export const currentCreditWindow = (
  period: CreditPeriod,
  billingPeriod: { start: Date; end: Date } | null,
  now = new Date(),
): CreditWindow => {
  if (period === 'daily') {
    const start = startOfUtcDay(now);
    const resetsAt = new Date(start);
    resetsAt.setUTCDate(start.getUTCDate() + 1);
    return { key: `d:${isoDate(start)}`, resetsAt };
  }

  if (billingPeriod) {
    return {
      key: `m:${isoDate(billingPeriod.start)}`,
      resetsAt: billingPeriod.end,
    };
  }

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resetsAt = new Date(start);
  resetsAt.setUTCMonth(start.getUTCMonth() + 1);
  return { key: `m:${isoDate(start)}`, resetsAt };
};
