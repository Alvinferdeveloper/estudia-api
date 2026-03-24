import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../typeorm/entities/Document.entity';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFParse } from 'pdf-parse';

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
  private embeddingModel: string = 'models/gemini-embedding-001';

  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  }

  private async extractTextFromPDF(url: string): Promise<string> {
    const parser = new PDFParse({ url });
    const result = await parser.getText();
    return result.text;
  }

  private chunkText(text: string, chunkSize: number = 500, overlap: number = 50): Chunk[] {
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

  private async generateEmbedding(text: string): Promise<number[]> {
    const model = this.genAI.getGenerativeModel({ model: this.embeddingModel });
    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  async vectorizeDocument(documentId: string, userId: string): Promise<{ chunksCreated: number }> {
    const document = await this.documentsRepository.findOne({
      where: { id: documentId, userId },
    });
    if (!document) {
      throw new Error('Document not found');
    }

    const { data } = await this.supabase.storage
      .from('documents')
      .createSignedUrl(document.filePath, 60 * 60 * 24);
    if (!data) {
      throw new Error('Failed to get document');
    }

    const text = await this.extractTextFromPDF(data.signedUrl!);

    if (!text || text.trim().length < 50) {
      throw new Error('No readable text found in PDF');
    }

    await this.deleteDocumentChunks(documentId);

    const chunks = this.chunkText(text);
    const BATCH_SIZE = 5;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await Promise.all(
        batch.map((chunk) => this.generateEmbedding(chunk.content))
      );

      const records = batch.map((chunk, idx) => ({
        document_id: documentId,
        page_number: chunk.pageNumber,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        embedding: embeddings[idx],
      }));

      const { error } = await this.supabase.from('document_chunks').insert(records);
      if (error) {
        console.error('Supabase insert error:', error);
        throw new Error(`Failed to save chunks: ${error.message}`);
      }
    }

    await this.documentsRepository.update(documentId, {
      isVectorized: true,
    } as any);

    return { chunksCreated: chunks.length };
  }

  async searchDocument(
    documentId: string,
    query: string,
    limit: number = 5,
  ): Promise<SearchResult[]> {
    const queryEmbedding = await this.generateEmbedding(query);

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
        const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
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
    let dot = 0, magA = 0, magB = 0;
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

  async isDocumentVectorized(documentId: string): Promise<boolean> {
    const document = await this.documentsRepository.findOne({ where: { id: documentId } });
    return (document as any)?.isVectorized === true;
  }
}
