import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { RagModule } from '../rag/rag.module';
import { DocumentsModule } from '../documents/documents.module';
import { MessagesModule } from '../messages/messages.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { ChatService } from './chat/chat.service';
import { VisualQueryController } from './visual-query/visual-query.controller';
import { VisualQueryService } from './visual-query/visual-query.service';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import { createAIProvider } from './providers/provider.factory';
import { AICallLogService } from './metering/ai-call-log.service';
import { MeteredAIProvider } from './metering/metered-ai.provider';
import { MeteringModule } from './metering/metering.module';

@Module({
  imports: [
    MeteringModule,
    RagModule,
    DocumentsModule,
    MessagesModule,
    EntitlementsModule,
  ],
  controllers: [AIController, VisualQueryController],
  providers: [
    {
      provide: AI_PROVIDER,
      // The one place providers get wrapped: every AI call is metered, whatever the provider.
      useFactory: (callLog: AICallLogService) =>
        new MeteredAIProvider(createAIProvider(), callLog),
      inject: [AICallLogService],
    },
    AIService,
    ChatService,
    VisualQueryService,
  ],
  exports: [AIService],
})
export class AIModule {}
