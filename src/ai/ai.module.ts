import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { RagModule } from '../rag/rag.module';
import { DocumentsModule } from '../documents/documents.module';
import { VisualQueryController } from './visual-query/visual-query.controller';
import { VisualQueryService } from './visual-query/visual-query.service';

@Module({
  imports: [RagModule, DocumentsModule],
  controllers: [AIController, VisualQueryController],
  providers: [AIService, VisualQueryService],
  exports: [AIService],
})
export class AIModule {}
