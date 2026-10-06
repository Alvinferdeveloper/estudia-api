import type { AIProvider } from './ai-provider.interface';
import { GoogleGeminiProvider } from './google-gemini.provider';


export function createAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER || 'google';
  const apiKey = process.env.AI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error(
      'AI API key is not configured. Set AI_API_KEY or GOOGLE_API_KEY environment variable.',
    );
  }

  switch (provider) {
    case 'google':
      return new GoogleGeminiProvider(apiKey);
    default:
      throw new Error(`Unknown AI provider: ${provider}. Supported: google`);
  }
}
