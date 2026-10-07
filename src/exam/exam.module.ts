import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Exam } from '../typeorm/entities/Exam.entity';
import { ExamQuestion } from '../typeorm/entities/ExamQuestion.entity';
import { ExamAttempt } from '../typeorm/entities/ExamAttempt.entity';
import { ExamAnswer } from '../typeorm/entities/ExamAnswer.entity';
import { Document } from '../typeorm/entities/Document.entity';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';
import { AIModule } from '../ai/ai.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Exam,
      ExamQuestion,
      ExamAttempt,
      ExamAnswer,
      Document,
    ]),
    AIModule,
    EntitlementsModule,
  ],
  controllers: [ExamController],
  providers: [ExamService],
  exports: [ExamService],
})
export class ExamModule {}
