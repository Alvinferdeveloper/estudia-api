import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUserId } from '../../common/decorators/user.decorator';
import { VisualQueryService } from './visual-query.service';
import { VisualQueryDto } from './visual-query.dto';
import { CreditsService } from '../../entitlements/credits/credits.service';

@Controller('documents')
@UseGuards(AuthGuard)
export class VisualQueryController {
  constructor(
    private readonly visualQueryService: VisualQueryService,
    private readonly creditsService: CreditsService,
  ) {}

  @Post(':documentId/visual-query')
  async visualQuery(
    @Param('documentId') documentId: string,
    @CurrentUserId() userId: string,
    @Body() dto: VisualQueryDto,
  ) {
    const answer = await this.creditsService.charge(
      userId,
      { action: 'visualQuery.ask' },
      () =>
        this.visualQueryService.answer({
          documentId,
          userId,
          question: dto.question,
          imageBase64: dto.imageBase64,
          imageXref: dto.imageXref,
          pageNumber: dto.pageNumber,
          responseLanguage: dto.responseLanguage,
        }),
    );
    return { answer };
  }
}
