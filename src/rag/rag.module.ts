import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../typeorm/entities/Document.entity';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';
import { MeteringModule } from '../ai/metering/metering.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    MeteringModule,
    DocumentsModule,
  ],
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
