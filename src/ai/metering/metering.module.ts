import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AICallLog } from '../../typeorm/entities/AICallLog.entity';
import { AICallLogService } from './ai-call-log.service';

// Its own module so AI work outside the AI module (document indexing) is logged too.
@Module({
  imports: [TypeOrmModule.forFeature([AICallLog])],
  providers: [AICallLogService],
  exports: [AICallLogService],
})
export class MeteringModule {}
