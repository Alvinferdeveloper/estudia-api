import { Controller, Post, Get, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { RagService } from './rag.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';

@Controller('documents')
@UseGuards(AuthGuard)
export class RagController {
  constructor(private readonly ragService: RagService) { }

  @Post(':id/vectorize')
  async vectorizeDocument(
    @Param('id') documentId: string,
    @CurrentUserId() userId: string,
  ) {
    try {
      const result = await this.ragService.vectorizeDocument(documentId, userId);
      return { success: true, ...result };
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  @Get(':id/search')
  async searchDocument(
    @Param('id') documentId: string,
    @CurrentUserId() userId: string,
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    if (!query) {
      throw new BadRequestException('Query parameter "q" is required');
    }
    const isVectorized = await this.ragService.isDocumentVectorized(documentId);
    if (!isVectorized) {
      return { results: [], message: 'Document not vectorized yet' };
    }
    const results = await this.ragService.searchDocument(
      documentId,
      query,
      limit ? parseInt(limit, 10) : 5,
    );
    return { results };
  }

  @Get(':id/vectorize-status')
  async getVectorizeStatus(
    @Param('id') documentId: string,
    @CurrentUserId() userId: string,
  ) {
    const isVectorized = await this.ragService.isDocumentVectorized(documentId);
    return { isVectorized };
  }
}
