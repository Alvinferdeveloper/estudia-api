import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  generateText,
  streamText,
  smoothStream,
  toUIMessageStream,
  createUIMessageStreamResponse,
  toTextStream,
  createTextStreamResponse,
} from 'ai';
import type { LanguageModelUsage, ModelMessage } from 'ai';
import { Logger } from '@nestjs/common';
import type {
  AIProvider,
  AIFeature,
  AIUsage,
  GenerateTextOptions,
  AICompletion,
  StreamTextOptions,
  StreamTextResult,
} from './ai-provider.interface';
import { AIProviderException } from './ai-provider.exception';
import { ErrorCode } from '../../common/errors/error-codes';

interface FeatureModel {
  model: string;
  // Caps the cost of a single call. On Gemini 2.5 it also covers thinking tokens, hence the headroom.
  maxOutputTokens: number;
}

const FEATURE_MODELS: Record<AIFeature, FeatureModel> = {
  chat: { model: 'gemini-2.5-flash', maxOutputTokens: 8192 },
  exam: { model: 'gemini-2.5-flash', maxOutputTokens: 16384 },
  noteStream: { model: 'gemini-2.5-flash-lite', maxOutputTokens: 4096 },
  vocabulary: { model: 'gemini-2.5-flash', maxOutputTokens: 4096 },
  flashcards: { model: 'gemini-2.5-flash', maxOutputTokens: 4096 },
  // Higher-quality, vision-capable tier for user-facing image explanations.
  visualQuery: { model: 'gemini-2.5-pro', maxOutputTokens: 8192 },
};

const toUsage = (model: string, usage: LanguageModelUsage): AIUsage => ({
  model,
  inputTokens: usage.inputTokens ?? 0,
  outputTokens: usage.outputTokens ?? 0,
  reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
});

export class GoogleGeminiProvider implements AIProvider {
  private readonly logger = new Logger(GoogleGeminiProvider.name);
  private client: ReturnType<typeof createGoogleGenerativeAI>;

  constructor(apiKey: string) {
    this.client = createGoogleGenerativeAI({ apiKey });
  }

  async generateText(options: GenerateTextOptions): Promise<AICompletion> {
    const { feature, systemPrompt } = options;
    const { model, maxOutputTokens } = FEATURE_MODELS[feature];
    const modelMessages: ModelMessage[] =
      options.messages ?? [{ role: 'user', content: options.userPrompt }];

    try {
      const result = await generateText({
        model: this.client(model),
        system: systemPrompt,
        messages: modelMessages,
        maxOutputTokens,
      });

      return { text: result.text, usage: toUsage(model, result.totalUsage) };
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
    metadata,
  }: StreamTextOptions): Promise<StreamTextResult> {
    const { model, maxOutputTokens } = FEATURE_MODELS[feature];

    try {
      const result = streamText({
        model: this.client(model),
        system: systemPrompt,
        messages,
        maxOutputTokens,
        // Gemini emits large, uneven chunks; re-pace them word by word so the text reads as it's written.
        experimental_transform: smoothStream({ delayInMs: 15, chunking: 'word' }),
      });

      const response =
        feature === 'chat'
          ? createUIMessageStreamResponse({
              stream: toUIMessageStream({
                stream: result.stream,
                messageMetadata: ({ part }) =>
                  part.type === 'start' ? metadata : undefined,
                // Client gets this as `errorText`; never the raw provider error.
                onError: () => ErrorCode.AI_PROVIDER_ERROR,
              }),
            })
          : createTextStreamResponse({
              stream: toTextStream({ stream: result.stream }),
            });

      const completion = Promise.all([result.text, result.totalUsage]).then(
        ([text, total]) => ({ text, usage: toUsage(model, total) }),
        () => null,
      );

      return { stream: response.body!, completion };
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
