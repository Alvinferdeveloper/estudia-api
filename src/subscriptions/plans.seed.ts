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
          name: 'Free',
          price: 0,
          description: 'Perfect for trying out the platform',
          features: [
            '3 documents',
            '30 AI chat messages/month',
            '20 AI notes/month',
            '50MB storage',
            'Semantic search',
            'Document vectorization',
          ],
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
          name: 'Basic',
          price: 9.99,
          description: 'For students who need more AI features',
          features: [
            '20 documents',
            '200 AI chat messages/month',
            '100 AI notes/month',
            '500MB storage',
            'Semantic search',
            'Document vectorization',
          ],
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
          name: 'Pro',
          price: 24.99,
          description: 'For power users and researchers',
          features: [
            '100 documents',
            '1,000 AI chat messages/month',
            '500 AI notes/month',
            '5GB storage',
            'Semantic search',
            'Document vectorization',
            'Advanced AI models',
            'Export notes',
          ],
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
          name: 'Enterprise',
          price: 99,
          description: 'For teams and organizations',
          features: [
            'Unlimited documents',
            '10,000 AI chat messages/month',
            '5,000 AI notes/month',
            '50GB storage',
            'All Pro features',
            'API access',
            'Priority support',
          ],
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
