import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../typeorm/entities/Document.entity';
import { DocumentImage } from '../typeorm/entities/DocumentImage.entity';
import 'dotenv/config';

interface ParsedImage {
  xref: number;
  page_number: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface ParsedPage {
  page_number: number;
  markdown: string;
  width: number;
  height: number;
}

interface ParseResponse {
  markdown: string;
  pages: ParsedPage[];
  images: ParsedImage[];
}

@Injectable()
export class DocumentIngestionService {
  private readonly logger = new Logger(DocumentIngestionService.name);
  private readonly parserUrl =
    process.env.PARSER_SERVICE_URL || 'http://localhost:8000';
  // Ingestions in progress, so vectorization can wait for the parser's text instead of falling back to pdf-parse.
  private readonly running = new Map<string, Promise<void>>();

  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
    @InjectRepository(DocumentImage)
    private documentImagesRepository: Repository<DocumentImage>,
  ) {}

  /**
   * Fire-and-forget entry point: uploadDocument() must not wait on this.
   * There's no job queue yet, so failures here only surface in logs — the
   * document stays usable, just without structured markdown/image refs
   * (rag.service falls back to the old pdf-parse path when markdownContent
   * is null).
   */
  ingestInBackground(
    documentId: string,
    buffer: Buffer,
    fileName: string,
  ): void {
    const run = this.ingest(documentId, buffer, fileName)
      .catch((error) => {
        this.logger.error(
          `Ingestion failed for document ${documentId}:`,
          error instanceof Error ? error.stack : String(error),
        );
      })
      .finally(() => this.running.delete(documentId));
    this.running.set(documentId, run);
  }

  // Resolves when the document's ingestion ends (right away if none is running), or after timeoutMs at most.
  async waitForIngestion(documentId: string, timeoutMs: number): Promise<void> {
    const run = this.running.get(documentId);
    if (!run) return;
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    });
    await Promise.race([run, timeout]);
    clearTimeout(timer);
  }

  private async ingest(
    documentId: string,
    buffer: Buffer,
    fileName: string,
  ): Promise<void> {
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }),
      fileName,
    );

    const response = await fetch(`${this.parserUrl}/parse`, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      throw new Error(
        `Parser service returned ${response.status}: ${await response.text()}`,
      );
    }

    const parsed = (await response.json()) as ParseResponse;

    await this.documentsRepository.update(documentId, {
      markdownContent: parsed.markdown,
    });

    if (parsed.images.length > 0) {
      const rows = parsed.images.map((img) =>
        this.documentImagesRepository.create({
          documentId,
          pageNumber: img.page_number,
          xref: img.xref,
          bboxX0: img.bbox.x0,
          bboxY0: img.bbox.y0,
          bboxX1: img.bbox.x1,
          bboxY1: img.bbox.y1,
        }),
      );
      await this.documentImagesRepository.save(rows);
    }

    this.logger.log(
      `Ingested document ${documentId}: ${parsed.pages.length} pages, ${parsed.images.length} images`,
    );
  }
}
