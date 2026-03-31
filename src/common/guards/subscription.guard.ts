import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';

export enum SubscriptionFeature {
  CHAT = 'chat',
  AI_NOTE = 'ai_note',
  SEMANTIC_SEARCH = 'semantic_search',
  VECTORIZATION = 'vectorization',
  ADVANCED_MODELS = 'advanced_models',
  EXPORT_NOTES = 'export_notes',
  API_ACCESS = 'api_access',
}

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private subscriptionsService: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    const subscription = await this.subscriptionsService.getOrCreateSubscription(userId);
    
    if (!subscription.isActive) {
      throw new ForbiddenException('Subscription is not active');
    }

    request.subscription = subscription;
    return true;
  }
}

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private subscriptionsService: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const feature = request.route?.path?.split('/').pop() as SubscriptionFeature;

    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    const subscription = await this.subscriptionsService.getOrCreateSubscription(userId);

    const featureChecks: Record<string, () => boolean> = {
      [SubscriptionFeature.CHAT]: () => 
        subscription.chatMessagesUsed < subscription.chatMessagesLimit,
      [SubscriptionFeature.AI_NOTE]: () => 
        subscription.aiNotesUsed < subscription.aiNotesLimit,
      [SubscriptionFeature.SEMANTIC_SEARCH]: () => 
        subscription.hasSemanticSearch,
      [SubscriptionFeature.VECTORIZATION]: () => 
        subscription.hasVectorization,
      [SubscriptionFeature.ADVANCED_MODELS]: () => 
        subscription.hasAdvancedModels,
      [SubscriptionFeature.EXPORT_NOTES]: () => 
        subscription.hasExportNotes,
      [SubscriptionFeature.API_ACCESS]: () => 
        subscription.hasApiAccess,
    };

    const check = featureChecks[feature];
    if (check && !check()) {
      const featureNames: Record<string, string> = {
        [SubscriptionFeature.CHAT]: 'AI Chat',
        [SubscriptionFeature.AI_NOTE]: 'AI Notes',
        [SubscriptionFeature.SEMANTIC_SEARCH]: 'Semantic Search',
        [SubscriptionFeature.VECTORIZATION]: 'Document Vectorization',
        [SubscriptionFeature.ADVANCED_MODELS]: 'Advanced Models',
        [SubscriptionFeature.EXPORT_NOTES]: 'Export Notes',
        [SubscriptionFeature.API_ACCESS]: 'API Access',
      };

      throw new ForbiddenException(
        `You have reached the limit for ${featureNames[feature] || feature}. Upgrade your plan to continue.`,
      );
    }

    request.subscription = subscription;
    return true;
  }
}
