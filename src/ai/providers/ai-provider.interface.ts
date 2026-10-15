import type { ModelMessage } from 'ai';

export type AIFeature =
  | 'chat'
  | 'exam'
  | 'noteStream'
  | 'vocabulary'
  | 'flashcards'
  | 'visualQuery';

// Providers reject a request without user input, so every call must carry a prompt or messages.
export type GenerateTextOptions = {
  feature: AIFeature;
  systemPrompt?: string;
} & (
  | { userPrompt: string; messages?: never }
  | { messages: ModelMessage[]; userPrompt?: never }
);

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

export interface AICompletion {
  text: string;
  usage: AIUsage;
}

export interface StreamTextResult {
  stream: ReadableStream;
  // Settles when the stream ends (text and token counts are only known then); null if it failed.
  completion: Promise<AICompletion | null>;
}

export interface AIProvider {
  generateText(options: GenerateTextOptions): Promise<AICompletion>;
  streamText(options: StreamTextOptions): Promise<StreamTextResult>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
