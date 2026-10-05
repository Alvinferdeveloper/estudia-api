import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from '../typeorm/entities/Plan.entity';
import { SubscriptionPlan } from '../typeorm/entities/Subscription.entity';

@Injectable()
export class PlansSeed implements OnModuleInit {
  constructor(
    @InjectRepository(Plan)
    private planRepository: Repository<Plan>,
  ) {}

  async onModuleInit() {
    const existingPlans = await this.planRepository.count();

    if (existingPlans === 0) {
      const plans = [
        {
          plan: SubscriptionPlan.FREE,
          price: 0,
          isPopular: false,
          chatMessagesLimit: 30,
          aiNotesLimit: 20,
          documentsLimit: 3,
          storageLimitBytes: 52428800,
          hasSemanticSearch: true,
          hasVectorization: true,
          hasAdvancedModels: false,
          hasExportNotes: false,
          hasApiAccess: false,
          isActive: true,
        },
        {
          plan: SubscriptionPlan.BASIC,
          price: 9.99,
          isPopular: true,
          chatMessagesLimit: 200,
          aiNotesLimit: 100,
          documentsLimit: 20,
          storageLimitBytes: 524288000,
          hasSemanticSearch: true,
          hasVectorization: true,
          hasAdvancedModels: false,
          hasExportNotes: false,
          hasApiAccess: false,
          isActive: true,
        },
        {
          plan: SubscriptionPlan.PRO,
          price: 24.99,
          isPopular: false,
          chatMessagesLimit: 1000,
          aiNotesLimit: 500,
          documentsLimit: 100,
          storageLimitBytes: 5368709120,
          hasSemanticSearch: true,
          hasVectorization: true,
          hasAdvancedModels: true,
          hasExportNotes: true,
          hasApiAccess: false,
          isActive: true,
        },
        {
          plan: SubscriptionPlan.ENTERPRISE,
          price: 99,
          isPopular: false,
          chatMessagesLimit: 10000,
          aiNotesLimit: 5000,
          documentsLimit: -1,
          storageLimitBytes: 53687091200,
          hasSemanticSearch: true,
          hasVectorization: true,
          hasAdvancedModels: true,
          hasExportNotes: true,
          hasApiAccess: true,
          isActive: true,
        },
      ];

      for (const planData of plans) {
        const plan = this.planRepository.create(planData);
        await this.planRepository.save(plan);
      }

      console.log('✅ Plans seeded successfully');
    }
  }
}
