import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../typeorm/entities/Document.entity';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';
import { MeteringModule } from '../ai/metering/metering.module';

@Module({
  imports: [TypeOrmModule.forFeature([Document]), MeteringModule],
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
