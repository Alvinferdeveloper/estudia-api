import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Topic } from '../typeorm/entities/Topic.entity';
import { TopicsController } from './topics.controller';
import { TopicsService } from './topics.service';
import { User } from '../typeorm/entities/User.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Topic, User])],
  controllers: [TopicsController],
  providers: [TopicsService],
  exports: [TopicsService],
})
export class TopicsModule { }
