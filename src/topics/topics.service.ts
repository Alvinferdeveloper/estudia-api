import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Topic } from '../typeorm/entities/Topic.entity';

@Injectable()
export class TopicsService {
  constructor(
    @InjectRepository(Topic)
    private topicsRepository: Repository<Topic>,
  ) { }

  async createTopic(name: string, userId: string): Promise<Topic> {
    const newTopic = this.topicsRepository.create({ name, userId });
    return this.topicsRepository.save(newTopic);
  }

  async findAllTopics(userId: string): Promise<Topic[]> {
    return this.topicsRepository.find({ where: { userId } });
  }

  async findOneTopic(id: string, userId: string): Promise<Topic | null> {
    return this.topicsRepository.findOne({ where: { id, userId } });
  }

  async updateTopic(id: string, name: string, userId: string): Promise<Topic> {
    const topic = await this.topicsRepository.findOne({ where: { id, userId } });
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }
    topic.name = name;
    return this.topicsRepository.save(topic);
  }

  async removeTopic(id: string, userId: string): Promise<void> {
    const result = await this.topicsRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException('Topic not found');
    }
  }
}
