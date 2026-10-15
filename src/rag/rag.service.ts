import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../typeorm/entities/Document.entity';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFParse } from 'pdf-parse';
import { ErrorCode } from '../common/errors/error-codes';
import {
  AICallLogService,
  type EmbeddingFeature,
} from '../ai/metering/ai-call-log.service';
import type { AIUsage } from '../ai/providers/ai-provider.interface';
import { DocumentIngestionService } from '../documents/document-ingestion.service';

const EMBEDDING_MODEL = 'gemini-embedding-001';
// How long vectorization waits for a document's parsing before using the pdf-parse fallback.
const INGESTION_WAIT_MS = 2 * 60 * 1000;
// Gemini embeds up to 100 texts per batch request.
const EMBEDDING_BATCH_SIZE = 100;
// The embedding API reports no token counts; ~4 characters per token is close enough to watch costs.
const estimateTokens = (texts: string[]): number =>
  Math.ceil(texts.reduce((total, text) => total + text.length, 0) / 4);

export interface Chunk {
  pageNumber: number;
  chunkIndex: number;
  content: string;
}

export interface SearchResult {
  content: string;
  pageNumber: number;
  similarity: number;
}

@Injectable()
export class RagService {
  private supabase: SupabaseClient;
  private genAI: GoogleGenerativeAI;
  private readonly indexing = new Map<
    string,
    Promise<{ chunksCreated: number }>
  >();

  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
    private readonly callLog: AICallLogService,
    private readonly ingestion: DocumentIngestionService,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  }

  // Pages joined with a form feed, the separator chunkText splits on (the parser service uses it too);
  // pdf-parse's own text marks pages with "-- n of N --" instead, which left every chunk on page 1.
  private async extractTextFromPDF(url: string): Promise<string> {
    const parser = new PDFParse({ url });
    const { pages } = await parser.getText();
    const pageCount = Math.max(0, ...pages.map((page) => page.num));
    const textByPage = new Map(pages.map((page) => [page.num, page.text]));
    return Array.from(
      { length: pageCount },
      (_, index) => textByPage.get(index + 1) ?? '',
    ).join('\f');
  }

  private chunkText(
    text: string,
    chunkSize: number = 500,
    overlap: number = 50,
  ): Chunk[] {
    const pages = text.split(/\f/);
    const chunks: Chunk[] = [];
    let globalIndex = 0;

    pages.forEach((pageContent, pageIdx) => {
      const pageNum = pageIdx + 1;
      const cleanPage = pageContent.replace(/^\d+\s*\n/gm, '').trim();
      if (!cleanPage) return;

      const sentences = cleanPage.match(/[^.!?]+[.!?]+/g) || [cleanPage];
      let currentChunk = '';
      let chunkIdx = 0;

      sentences.forEach((sentence) => {
        const trimmed = sentence.trim();
        if (!trimmed) return;

        if (currentChunk.length + trimmed.length <= chunkSize) {
          currentChunk += (currentChunk ? ' ' : '') + trimmed;
        } else {
          if (currentChunk) {
            chunks.push({
              pageNumber: pageNum,
              chunkIndex: globalIndex++,
              content: currentChunk.trim(),
            });
            chunkIdx++;
          }
          currentChunk = trimmed;
        }
      });

      if (currentChunk.trim()) {
        chunks.push({
          pageNumber: pageNum,
          chunkIndex: globalIndex++,
          content: currentChunk.trim(),
        });
      }
    });

    return chunks;
  }

  // One request for up to EMBEDDING_BATCH_SIZE texts, logged to ai_call_log like every other AI call.
  private async embed(
    texts: string[],
    feature: EmbeddingFeature,
    userId: string,
  ): Promise<number[][]> {
    const startedAt = Date.now();
    let usage: AIUsage | null = null;
    try {
      const model = this.genAI.getGenerativeModel({
        model: `models/${EMBEDDING_MODEL}`,
      });
      const { embeddings } = await model.batchEmbedContents({
        requests: texts.map((text) => ({
          content: { role: 'user', parts: [{ text }] },
        })),
      });
      usage = {
        model: EMBEDDING_MODEL,
        inputTokens: estimateTokens(texts),
        outputTokens: 0,
        reasoningTokens: 0,
      };
      return embeddings.map((embedding) => embedding.values);
    } finally {
      void this.callLog.record({
        feature,
        startedAt,
        usage,
        context: { userId },
      });
    }
  }

  private async findOwnedDocument(
    documentId: string,
    userId: string,
  ): Promise<Document> {
    const document = await this.documentsRepository.findOne({
      where: { id: documentId, userId },
    });
    if (!document) {
      throw new NotFoundException({ code: ErrorCode.DOCUMENT_NOT_FOUND });
    }
    return document;
  }

  // Embeds a document once: already indexed documents cost nothing, and concurrent requests
  // (opening the reader, a chat question) share the run in progress. The lock is per process.
  async vectorizeDocument(
    documentId: string,
    userId: string,
  ): Promise<{ chunksCreated: number }> {
    const document = await this.findOwnedDocument(documentId, userId);
    if (document.isVectorized) return { chunksCreated: 0 };

    let run = this.indexing.get(documentId);
    if (!run) {
      run = this.indexDocument(document, userId).finally(() =>
        this.indexing.delete(documentId),
      );
      this.indexing.set(documentId, run);
    }
    return run;
  }

  private async indexDocument(
    document: Document,
    userId: string,
  ): Promise<{ chunksCreated: number }> {
    const documentId = document.id;
    // A document opened right after upload may still be parsing; its Markdown beats the pdf-parse fallback.
    await this.ingestion.waitForIngestion(documentId, INGESTION_WAIT_MS);
    const parsed = await this.documentsRepository.findOne({
      where: { id: documentId },
      select: { id: true, markdownContent: true },
    });
    let text = parsed?.markdownContent ?? null;

    if (!text) {
      const { data } = await this.supabase.storage
        .from('documents')
        .createSignedUrl(document.filePath, 60 * 60 * 24);
      if (!data) {
        throw new Error('Failed to get document');
      }

      text = await this.extractTextFromPDF(data.signedUrl);
    }

    if (!text || text.trim().length < 50) {
      throw new BadRequestException({
        code: ErrorCode.DOCUMENT_NO_READABLE_TEXT,
      });
    }

    await this.deleteDocumentChunks(documentId);

    const chunks = this.chunkText(text);

    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const embeddings = await this.embed(
        batch.map((chunk) => chunk.content),
        'documentIndexing',
        userId,
      );

      const records = batch.map((chunk, idx) => ({
        document_id: documentId,
        page_number: chunk.pageNumber,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        embedding: embeddings[idx],
      }));

      const { error } = await this.supabase
        .from('document_chunks')
        .insert(records);
      if (error) {
        console.error('Supabase insert error:', error);
        throw new Error(`Failed to save chunks: ${error.message}`);
      }
    }

    await this.documentsRepository.update(documentId, { isVectorized: true });

    return { chunksCreated: chunks.length };
  }

  async searchDocument(
    documentId: string,
    userId: string,
    query: string,
    limit: number = 5,
  ): Promise<SearchResult[]> {
    const [queryEmbedding] = await this.embed(
      [query],
      'semanticSearch',
      userId,
    );

    const { data, error } = await this.supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_document_id: documentId,
      match_threshold: 0.5,
      match_count: limit,
    });

    if (error) {
      const { data: fallbackData } = await this.supabase
        .from('document_chunks')
        .select('content, page_number, embedding')
        .eq('document_id', documentId)
        .limit(20);

      if (!fallbackData) return [];

      const scored = fallbackData.map((chunk: any) => {
        const similarity = this.cosineSimilarity(
          queryEmbedding,
          chunk.embedding,
        );
        return {
          content: chunk.content,
          pageNumber: chunk.page_number,
          similarity,
        };
      });

      return scored
        .filter((s) => s.similarity > 0.5)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    }

    return (data || []).map((row: any) => ({
      content: row.content,
      pageNumber: row.page_number,
      similarity: row.similarity,
    }));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0,
      magA = 0,
      magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  private async deleteDocumentChunks(documentId: string): Promise<void> {
    await this.supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', documentId);
  }

  async isDocumentVectorized(
    documentId: string,
    userId: string,
  ): Promise<boolean> {
    const document = await this.findOwnedDocument(documentId, userId);
    return document.isVectorized;
  }
}
