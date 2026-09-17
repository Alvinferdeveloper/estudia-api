import type { ModelMessage } from 'ai';

export type AIFeature =
  | 'chat'
  | 'exam'
  | 'noteGeneration'
  | 'noteStream'
  | 'vocabulary';

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

export interface AIProvider {
  generateText(options: GenerateTextOptions): Promise<string>;
  streamText(options: StreamTextOptions): Promise<ReadableStream>;
}
