import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  generateText,
  streamText,
  toUIMessageStream,
  createUIMessageStreamResponse,
  toTextStream,
  createTextStreamResponse,
} from 'ai';
import type { ModelMessage } from 'ai';
import { Logger } from '@nestjs/common';
import type {
  AIProvider,
  AIFeature,
  GenerateTextOptions,
  StreamTextOptions,
} from './ai-provider.interface';
import { AIProviderException } from './ai-provider.exception';

const MODELS: Record<AIFeature, string> = {
  chat: 'gemini-2.5-flash',
  exam: 'gemini-2.5-flash',
  noteGeneration: 'gemini-3-flash-preview',
  noteStream: 'gemini-2.5-flash-lite',
  vocabulary: 'gemini-2.5-flash',
};

export class GoogleGeminiProvider implements AIProvider {
  private readonly logger = new Logger(GoogleGeminiProvider.name);
  private client: ReturnType<typeof createGoogleGenerativeAI>;

  constructor(apiKey: string) {
    this.client = createGoogleGenerativeAI({ apiKey });
  }

  async generateText({
    feature,
    systemPrompt,
    messages,
    userPrompt,
  }: GenerateTextOptions): Promise<string> {
    const modelMessages: ModelMessage[] = messages?.length
      ? messages
      : [{ role: 'user', content: userPrompt || '' }];

    try {
      const result = await generateText({
        model: this.client(MODELS[feature]),
        system: systemPrompt,
        messages: modelMessages,
      });

      return result.text;
    } catch (error) {
      this.logger.error(
        `generateText failed for feature '${feature}':`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new AIProviderException(
        `AI provider failed on '${feature}': ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
        error,
      );
    }
  }

  async streamText({
    feature,
    systemPrompt,
    messages,
  }: StreamTextOptions): Promise<ReadableStream> {
    try {
      const result = streamText({
        model: this.client(MODELS[feature]),
        system: systemPrompt,
        messages,
      });

      const response =
        feature === 'chat'
          ? createUIMessageStreamResponse({
              stream: toUIMessageStream({ stream: result.stream }),
            })
          : createTextStreamResponse({
              stream: toTextStream({ stream: result.stream }),
            });

      return response.body!;
    } catch (error) {
      this.logger.error(
        `streamText failed for feature '${feature}':`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new AIProviderException(
        `AI provider failed to start stream on '${feature}': ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
        error,
      );
    }
  }
}
