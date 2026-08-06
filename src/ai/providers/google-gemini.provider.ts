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
import type {
  AIProvider,
  AIFeature,
  GenerateTextOptions,
  StreamTextOptions,
} from './ai-provider.interface';

const MODELS: Record<AIFeature, string> = {
  chat: 'gemini-2.5-flash',
  exam: 'gemini-2.5-flash',
  noteGeneration: 'gemini-3-flash-preview',
  noteStream: 'gemini-2.5-flash-lite',
};

export class GoogleGeminiProvider implements AIProvider {
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

    const result = await generateText({
      model: this.client(MODELS[feature]),
      system: systemPrompt,
      messages: modelMessages,
    });

    return result.text;
  }

  async streamText({
    feature,
    systemPrompt,
    messages,
  }: StreamTextOptions): Promise<ReadableStream> {
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
  }
}
