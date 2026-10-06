// Single source of what plans can grant and what each AI action costs.
// Adding an AI action: one entry in CREDIT_COSTS plus a CreditsService.charge around its call.

// Credits per action. Params let an action's price scale with its size.
export const CREDIT_COSTS = {
  'chat.message': () => 1,
  'note.generate': () => 1,
  'vocabulary.explain': () => 1,
  'exam.generate': ({ questions }: { questions: number }) =>
    Math.ceil(questions / 5),
  // Uses the pro vision model, the most expensive call.
  'visualQuery.ask': () => 3,
} satisfies Record<string, (params: never) => number>;

export type CreditAction = keyof typeof CREDIT_COSTS;

type ActionParams<A extends CreditAction> = Parameters<
  (typeof CREDIT_COSTS)[A]
>[0];

// One shape per action: params are required exactly when that action's price depends on them.
export type CreditRequest = {
  [A in CreditAction]: ActionParams<A> extends undefined
    ? { action: A }
    : { action: A; params: ActionParams<A> };
}[CreditAction];

export const creditCost = (request: CreditRequest): number => {
  const cost = CREDIT_COSTS[request.action] as (params: unknown) => number;
  return cost('params' in request ? request.params : undefined);
};

// On/off features a plan includes.
export const PLAN_FEATURES = ['exportNotes'] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

// Limits on what a user keeps stored. -1 means unlimited.
export const PLAN_QUOTAS = ['documents', 'storageBytes'] as const;
export type PlanQuota = (typeof PLAN_QUOTAS)[number];

// Maximum size of a single action. -1 means unlimited.
export const PLAN_CAPS = ['examQuestions'] as const;
export type PlanCap = (typeof PLAN_CAPS)[number];

export const UNLIMITED = -1;

export const isWithinLimit = (limit: number, value: number): boolean =>
  limit === UNLIMITED || value <= limit;

export type CreditPeriod = 'daily' | 'monthly';

export interface PlanEntitlements {
  credits: { amount: number; period: CreditPeriod };
  features: PlanFeature[];
  quotas: Record<PlanQuota, number>;
  caps: Record<PlanCap, number>;
}
