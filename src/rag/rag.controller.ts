import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { RagService } from './rag.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';
import { ErrorCode } from '../common/errors/error-codes';

@Controller('documents')
@UseGuards(AuthGuard)
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post(':id/vectorize')
  async vectorizeDocument(
    @Param('id') documentId: string,
    @CurrentUserId() userId: string,
  ) {
    try {
      const result = await this.ragService.vectorizeDocument(
        documentId,
        userId,
      );
      return { success: true, ...result };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        code: ErrorCode.VECTORIZATION_FAILED,
        message: error instanceof Error ? error.message : String(error),
      });
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
      throw new BadRequestException({
        code: ErrorCode.INVALID_REQUEST,
        message: 'Query parameter "q" is required',
      });
    }
    const isVectorized = await this.ragService.isDocumentVectorized(documentId);
    if (!isVectorized) {
      return { results: [], vectorized: false };
    }
    const results = await this.ragService.searchDocument(
      documentId,
      userId,
      query,
      limit ? parseInt(limit, 10) : 5,
    );
    return { results, vectorized: true };
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
