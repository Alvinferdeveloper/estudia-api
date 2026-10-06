import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VocabularyEntry } from '../typeorm/entities/VocabularyEntry.entity';
import { VocabularyController } from './vocabulary.controller';
import { VocabularyService } from './vocabulary.service';

@Module({
  imports: [TypeOrmModule.forFeature([VocabularyEntry])],
  controllers: [VocabularyController],
  providers: [VocabularyService],
  exports: [VocabularyService],
})
export class VocabularyModule {}
