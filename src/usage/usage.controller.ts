import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { CreditsService } from '../entitlements/credits/credits.service';
import { DocumentsService } from '../documents/documents.service';
import { PLAN_QUOTAS } from '../entitlements/catalog';

// What the user's plan grants and how much of it they have used, in one response.
@Controller('usage')
@UseGuards(AuthGuard)
export class UsageController {
  constructor(
    private readonly entitlementsService: EntitlementsService,
    private readonly creditsService: CreditsService,
    private readonly documentsService: DocumentsService,
  ) {}

  @Get()
  async getUsage(@CurrentUserId() userId: string) {
    const [{ plan, entitlements }, credits, stored] = await Promise.all([
      this.entitlementsService.getEffective(userId),
      this.creditsService.getBalance(userId),
      this.documentsService.getStorageUsage(userId),
    ]);

    return {
      plan,
      credits,
      quotas: Object.fromEntries(
        PLAN_QUOTAS.map((quota) => [
          quota,
          { used: stored[quota], limit: entitlements.quotas[quota] },
        ]),
      ),
      features: entitlements.features,
      caps: entitlements.caps,
    };
  }
}
