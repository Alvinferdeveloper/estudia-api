import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { EntitlementsService } from './entitlements.service';
import type { PlanFeature } from './catalog';

const REQUIRED_FEATURE = 'requiredFeature';

// Runs after the controller's AuthGuard, which sets request.userId.
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.get<PlanFeature | undefined>(
      REQUIRED_FEATURE,
      context.getHandler(),
    );
    if (!feature) return true;

    const request = context.switchToHttp().getRequest<Request>();
    await this.entitlementsService.assertFeature(request['userId'], feature);
    return true;
  }
}

// Blocks the route with FEATURE_NOT_AVAILABLE unless the user's plan includes `feature`.
export const RequireFeature = (feature: PlanFeature) =>
  applyDecorators(
    SetMetadata(REQUIRED_FEATURE, feature),
    UseGuards(FeatureGuard),
  );
