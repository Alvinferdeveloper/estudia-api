import type {
  AIProvider,
  AIUsage,
  GenerateTextOptions,
  GenerateTextResult,
  StreamTextOptions,
  StreamTextResult,
} from '../providers/ai-provider.interface';
import { aiCallContext } from './ai-call-context';
import type { AICallLogService } from './ai-call-log.service';

// Decorator over any AIProvider: same interface, every call recorded with its tokens and cost.
export class MeteredAIProvider implements AIProvider {
  constructor(
    private readonly inner: AIProvider,
    private readonly callLog: AICallLogService,
  ) {}

  async generateText(
    options: GenerateTextOptions,
  ): Promise<GenerateTextResult> {
    const startedAt = Date.now();
    const context = aiCallContext.current();
    try {
      const result = await this.inner.generateText(options);
      void this.callLog.record({
        feature: options.feature,
        startedAt,
        usage: result.usage,
        context,
      });
      return result;
    } catch (error) {
      void this.callLog.record({
        feature: options.feature,
        startedAt,
        usage: null,
        context,
      });
      throw error;
    }
  }

  async streamText(options: StreamTextOptions): Promise<StreamTextResult> {
    const startedAt = Date.now();
    // Read now: the usage settles after the request's async context may be gone.
    const context = aiCallContext.current();
    const record = (usage: AIUsage | null) =>
      this.callLog.record({
        feature: options.feature,
        startedAt,
        usage,
        context,
      });

    try {
      const result = await this.inner.streamText(options);
      void result.usage.then(record);
      return result;
    } catch (error) {
      void record(null);
      throw error;
    }
  }
}
