import { Injectable, BadRequestException } from '@nestjs/common';
import { DocumentsService } from '../../documents/documents.service';
import { createVisualQueryProvider } from '../providers/visual-query-provider.factory';
import type { VisualQueryProvider } from '../providers/visual-query-provider.factory';
import 'dotenv/config';
import { responseLanguageInstruction } from '../language';
import { ErrorCode } from '../../common/errors/error-codes';

export interface VisualQueryParams {
  documentId: string;
  userId: string;
  question: string;
  imageBase64?: string;
  imageXref?: number;
  pageNumber?: number;
  responseLanguage?: string;
}

interface ExtractImageResponse {
  image_base64: string;
  mime_type: string;
}

@Injectable()
export class VisualQueryService {
  private readonly parserUrl =
    process.env.PARSER_SERVICE_URL || 'http://localhost:8000';
  private readonly provider: VisualQueryProvider;

  constructor(private readonly documentsService: DocumentsService) {
    this.provider = createVisualQueryProvider();
  }

  async answer(params: VisualQueryParams): Promise<string> {
    const {
      documentId,
      userId,
      question,
      imageXref,
      pageNumber,
      responseLanguage,
    } = params;
    let imageBase64 = params.imageBase64;
    let mimeType = 'image/png';

    if (!question || !question.trim()) {
      throw new BadRequestException({
        code: ErrorCode.INVALID_REQUEST,
        message: 'question is required',
      });
    }

    if (imageXref !== undefined) {
      const document = await this.documentsService.findOneDocument(
        documentId,
        userId,
      );
      if (!document.publicUrl) {
        throw new BadRequestException({
          code: ErrorCode.DOCUMENT_FILE_UNAVAILABLE,
        });
      }

      const extractUrl = `${this.parserUrl}/documents/extract-image?pdf_url=${encodeURIComponent(document.publicUrl)}&xref=${imageXref}`;
      const response = await fetch(extractUrl);
      if (!response.ok) {
        throw new BadRequestException({
          code: ErrorCode.IMAGE_EXTRACTION_FAILED,
          message: `Failed to extract image xref=${imageXref} (page ${pageNumber}): ${response.status}`,
        });
      }

      const data = (await response.json()) as ExtractImageResponse;
      imageBase64 = data.image_base64;
      mimeType = data.mime_type;
    } else if (imageBase64) {
      const dataUrlMatch = imageBase64.match(/^data:(image\/\w+);base64,(.*)$/);
      if (dataUrlMatch) {
        mimeType = dataUrlMatch[1];
        imageBase64 = dataUrlMatch[2];
      }
    } else {
      throw new BadRequestException({
        code: ErrorCode.INVALID_REQUEST,
        message: 'Either imageBase64 or imageXref must be provided',
      });
    }

    // TODO: no se persiste la pregunta/respuesta en este MVP (interacción
    // efímera). Si más adelante se quiere analytics o cachear preguntas
    // repetidas sobre la misma imagen (documentId + xref), loguear acá.
    return this.provider.explainImage({
      imageBase64,
      mimeType,
      question,
      instructions: responseLanguageInstruction(
        'userMessage',
        responseLanguage,
      ),
    });
  }
}
