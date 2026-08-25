import type { VisualQueryProvider } from './visual-query-provider.interface';
import { GoogleVisualQueryProvider } from './google-visual-query.provider';

export type { VisualQueryProvider } from './visual-query-provider.interface';

// Mirrors provider.factory.ts on purpose: swapping the model used for
// image explanations (e.g. to Anthropic later) means adding one class here
// and one switch case, without touching VisualQueryService or the controller.
export function createVisualQueryProvider(): VisualQueryProvider {
  const provider = process.env.VISUAL_QUERY_PROVIDER || 'google';
  const apiKey = process.env.AI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error(
      'AI API key is not configured. Set AI_API_KEY or GOOGLE_API_KEY environment variable.',
    );
  }

  switch (provider) {
    case 'google':
      return new GoogleVisualQueryProvider(apiKey);
    default:
      throw new Error(
        `Unknown visual query provider: ${provider}. Supported: google`,
      );
  }
}
