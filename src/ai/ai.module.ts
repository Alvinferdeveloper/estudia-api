import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { RagModule } from '../rag/rag.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [RagModule, DocumentsModule],
  controllers: [AIController],
  providers: [AIService],
  exports: [AIService],
})
export class AIModule {}
