import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AICallLog } from '../../typeorm/entities/AICallLog.entity';
import type { AIFeature, AIUsage } from '../providers/ai-provider.interface';
import type { AICallContext } from './ai-call-context';
import { estimateCostUsd } from './model-prices';

// Embedding calls go straight to the provider SDK, outside the text-generation features.
export type EmbeddingFeature = 'documentIndexing' | 'semanticSearch';

export interface AICallRecord {
  feature: AIFeature | EmbeddingFeature;
  startedAt: number;
  // Null when the call failed before reporting usage.
  usage: AIUsage | null;
  context: AICallContext | undefined;
}

@Injectable()
export class AICallLogService {
  private readonly logger = new Logger(AICallLogService.name);

  constructor(
    @InjectRepository(AICallLog)
    private readonly repository: Repository<AICallLog>,
  ) {}

  // Never throws: metering must not break the user's request.
  async record({ feature, startedAt, usage, context }: AICallRecord) {
    try {
      const costUsd = usage ? estimateCostUsd(usage) : null;
      if (usage && costUsd === null) {
        this.logger.warn(`No price configured for model '${usage.model}'`);
      }

      await this.repository.insert({
        userId: context?.userId ?? null,
        ledgerEntryId: context?.ledgerEntryId ?? null,
        feature,
        model: usage?.model ?? null,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        reasoningTokens: usage?.reasoningTokens ?? 0,
        costUsd: costUsd === null ? null : costUsd.toFixed(6),
        durationMs: Date.now() - startedAt,
        success: usage !== null,
      });
    } catch (error) {
      this.logger.error(
        `Failed to record AI call for '${feature}'`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
