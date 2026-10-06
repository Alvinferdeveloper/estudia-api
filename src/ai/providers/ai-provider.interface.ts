import type { ModelMessage } from 'ai';

export type AIFeature =
  | 'chat'
  | 'exam'
  | 'noteStream'
  | 'vocabulary'
  | 'visualQuery';

export interface GenerateTextOptions {
  feature: AIFeature;
  systemPrompt: string;
  messages?: ModelMessage[];
  userPrompt?: string;
}

export interface StreamTextOptions {
  feature: AIFeature;
  systemPrompt: string;
  messages: ModelMessage[];
}

// Provider-neutral usage, so metering works the same for any provider.
export interface AIUsage {
  model: string;
  inputTokens: number;
  // Includes reasoning tokens, which providers bill as output.
  outputTokens: number;
  reasoningTokens: number;
}

export interface GenerateTextResult {
  text: string;
  usage: AIUsage;
}

export interface StreamTextResult {
  stream: ReadableStream;
  // Settles when the stream ends (token counts are only known then); null if it failed.
  usage: Promise<AIUsage | null>;
}

export interface AIProvider {
  generateText(options: GenerateTextOptions): Promise<GenerateTextResult>;
  streamText(options: StreamTextOptions): Promise<StreamTextResult>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
