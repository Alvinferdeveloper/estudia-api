import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { Logger } from '@nestjs/common';
import type {
  VisualQueryProvider,
  VisualQueryInput,
} from './visual-query-provider.interface';
import { AIProviderException } from './ai-provider.exception';

// Vision-capable, higher-quality tier than the gemini-2.5-flash used for
// chat/exam — this is a direct user-facing explanation, not bulk indexing.
const MODEL = 'gemini-2.5-pro';

export class GoogleVisualQueryProvider implements VisualQueryProvider {
  private readonly logger = new Logger(GoogleVisualQueryProvider.name);
  private client: ReturnType<typeof createGoogleGenerativeAI>;

  constructor(apiKey: string) {
    this.client = createGoogleGenerativeAI({ apiKey });
  }

  async explainImage({
    imageBase64,
    mimeType,
    question,
  }: VisualQueryInput): Promise<string> {
    try {
      const result = await generateText({
        model: this.client(MODEL),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: question },
              { type: 'image', image: imageBase64, mediaType: mimeType },
            ],
          },
        ],
      });

      return result.text;
    } catch (error) {
      this.logger.error(
        'explainImage failed:',
        error instanceof Error ? error.stack : String(error),
      );
      throw new AIProviderException(
        `Visual query provider failed: ${error instanceof Error ? error.message : 'unknown error'
        }`,
        error,
      );
    }
  }
}
