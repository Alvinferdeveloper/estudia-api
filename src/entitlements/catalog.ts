// Single source of what plans can grant and what each AI action costs.
// Adding an AI action: one entry in CREDIT_COSTS plus a CreditsService.charge around its call.

// Credits per action. Params let an action's price scale with its size.
export const CREDIT_COSTS = {
  'chat.message': () => 1,
  'note.generate': () => 1,
  'vocabulary.explain': () => 1,
  // Mirrored in estudia-front's subscription/lib/entitlements.ts to show the price before generating.
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

export const CREDIT_PERIODS = ['daily', 'monthly'] as const;
export type CreditPeriod = (typeof CREDIT_PERIODS)[number];

export interface PlanEntitlements {
  credits: { amount: number; period: CreditPeriod };
  features: PlanFeature[];
  quotas: Record<PlanQuota, number>;
  caps: Record<PlanCap, number>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isLimit = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= UNLIMITED;

// Every listed key present as a limit, and no keys the catalog doesn't know.
const limitErrors = (
  field: string,
  value: unknown,
  keys: readonly string[],
): string[] => {
  if (!isRecord(value)) return [`${field} must be an object`];
  const missing = keys.filter((key) => !isLimit(value[key]));
  const unknown = Object.keys(value).filter((key) => !keys.includes(key));
  return [
    ...missing.map((key) => `${field}.${key} must be an integer >= -1`),
    ...unknown.map((key) => `${field}.${key} is not in the catalog`),
  ];
};

// Plans are edited directly in the database, so their JSON is checked against the catalog
// on every read: a typo fails loudly instead of silently granting or blocking something.
export const parsePlanEntitlements = (
  value: unknown,
): { entitlements: PlanEntitlements } | { errors: string[] } => {
  if (!isRecord(value)) return { errors: ['entitlements must be an object'] };
  const { credits, features, quotas, caps } = value;

  const errors = [
    ...(isRecord(credits) && isLimit(credits.amount)
      ? []
      : ['credits.amount must be an integer >= -1']),
    ...(isRecord(credits) &&
    CREDIT_PERIODS.includes(credits.period as CreditPeriod)
      ? []
      : [`credits.period must be one of ${CREDIT_PERIODS.join(', ')}`]),
    ...(Array.isArray(features)
      ? features
          .filter((f) => !PLAN_FEATURES.includes(f as PlanFeature))
          .map((f) => `features: '${String(f)}' is not in the catalog`)
      : ['features must be an array']),
    ...limitErrors('quotas', quotas, PLAN_QUOTAS),
    ...limitErrors('caps', caps, PLAN_CAPS),
  ];

  return errors.length
    ? { errors }
    : { entitlements: value as unknown as PlanEntitlements };
};
