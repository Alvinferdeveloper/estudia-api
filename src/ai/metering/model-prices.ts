import type { AIUsage } from '../providers/ai-provider.interface';

interface ModelPrice {
  // USD per million tokens.
  input: number;
  output: number;
}

// Gemini API paid-tier list prices (standard context); update when the provider changes them.
const MODEL_PRICES: Record<string, ModelPrice> = {
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-embedding-001': { input: 0.15, output: 0 },
};

const PER_MILLION = 1_000_000;

// Null when the model has no price yet, so a missing entry shows up in the log instead of as $0.
export const estimateCostUsd = (usage: AIUsage): number | null => {
  const price = MODEL_PRICES[usage.model];
  if (!price) return null;
  return (
    (usage.inputTokens * price.input + usage.outputTokens * price.output) /
    PER_MILLION
  );
};
