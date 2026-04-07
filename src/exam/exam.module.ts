import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Exam } from '../typeorm/entities/Exam.entity';
import { ExamQuestion } from '../typeorm/entities/ExamQuestion.entity';
import { ExamResult } from '../typeorm/entities/ExamResult.entity';
import { Document } from '../typeorm/entities/Document.entity';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';

@Module({
  imports: [TypeOrmModule.forFeature([Exam, ExamQuestion, ExamResult, Document])],
  controllers: [ExamController],
  providers: [ExamService],
  exports: [ExamService],
})
export class ExamModule {}
